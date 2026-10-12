import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

import { requireAuth } from "./lib/auth";
import {
  assertDate,
  assertEstimateMinutes,
  assertNonEmptyString,
  assertOptionalString,
  assertTime,
} from "./lib/validation";
import { toTimestamp } from "./lib/time";
import { isoWeekIdFromMillis, weekPeriodId } from "./lib/week";
import { computeAwardPoints, missedTaskPenalty } from "./lib/points";
import { leaderboardEntryRef } from "./lib/leaderboard";

admin.initializeApp();
const db = admin.firestore();

/** Auth trigger: create user profile doc. */
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;

  await db.doc(`users/${uid}`).set(
    {
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      timezone: "Europe/Berlin",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),

      totalPoints: 0,
      weeklyPoints: 0,
      currentWeekId: null,

      dailyStreak: 0,
      lastStreakDate: null,
    },
    { merge: true },
  );
});

/** Callable: createTask */
export const createTask = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const title = data?.title;
  const notes = data?.notes;
  const date = data?.date;
  const startTime = data?.startTime;
  const endTime = data?.endTime;
  const estimateMinutes = data?.estimateMinutes;
  const timezoneOverride = data?.timezone;

  assertNonEmptyString(title, "title", 120);
  assertOptionalString(notes, "notes", 2000);
  assertDate(date, "date");
  assertTime(startTime, "startTime");
  assertTime(endTime, "endTime");
  assertEstimateMinutes(estimateMinutes);

  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const userTz =
    typeof timezoneOverride === "string" && timezoneOverride.trim()
      ? timezoneOverride
      : (userSnap.data()?.timezone ?? "Europe/Berlin");

  const startAt = toTimestamp(date, startTime, userTz);
  const endAt = toTimestamp(date, endTime, userTz);

  if (endAt.toMillis() <= startAt.toMillis()) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "endTime must be after startTime (same day MVP).",
    );
  }

  const taskRef = db.collection("tasks").doc();
  await taskRef.set({
    uid,
    title: String(title).trim(),
    notes: notes ?? "",
    date,
    startTime,
    endTime,
    estimateMinutes,

    startAt,
    endAt,

    status: "planned",
    activeSessionId: null,

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { taskId: taskRef.id };
});

/** Callable: updateTask */
export const updateTask = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const taskId = data?.taskId;
  assertNonEmptyString(taskId, "taskId", 200);

  const taskRef = db.doc(`tasks/${taskId}`);
  const taskSnap = await taskRef.get();
  if (!taskSnap.exists)
    throw new functions.https.HttpsError("not-found", "Task not found.");

  const task = taskSnap.data()!;
  if (task.uid !== uid)
    throw new functions.https.HttpsError("permission-denied", "Not your task.");
  if (["completed", "missed"].includes(task.status)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Cannot edit task in status ${task.status}.`,
    );
  }

  const patch: any = {};

  if (data.title != null) {
    assertNonEmptyString(data.title, "title", 120);
    patch.title = String(data.title).trim();
  }
  if (data.notes != null) {
    assertOptionalString(data.notes, "notes", 2000);
    patch.notes = data.notes ?? "";
  }
  if (data.estimateMinutes != null) {
    assertEstimateMinutes(data.estimateMinutes);
    patch.estimateMinutes = data.estimateMinutes;
  }

  // Date/time changes -> recompute timestamps
  const date = data.date ?? task.date;
  const startTime = data.startTime ?? task.startTime;
  const endTime = data.endTime ?? task.endTime;

  if (data.date != null) assertDate(data.date, "date");
  if (data.startTime != null) assertTime(data.startTime, "startTime");
  if (data.endTime != null) assertTime(data.endTime, "endTime");

  if (data.date != null || data.startTime != null || data.endTime != null) {
    const userSnap = await db.doc(`users/${uid}`).get();
    const tz = userSnap.data()?.timezone ?? "Europe/Berlin";

    const startAt = toTimestamp(date, startTime, tz);
    const endAt = toTimestamp(date, endTime, tz);
    if (endAt.toMillis() <= startAt.toMillis()) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "endTime must be after startTime (same day MVP).",
      );
    }

    patch.date = date;
    patch.startTime = startTime;
    patch.endTime = endTime;
    patch.startAt = startAt;
    patch.endAt = endAt;
  }

  patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  await taskRef.update(patch);

  return { ok: true };
});

/** Callable: deleteTask */
export const deleteTask = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const taskId = data?.taskId;
  assertNonEmptyString(taskId, "taskId", 200);

  const taskRef = db.doc(`tasks/${taskId}`);
  const snap = await taskRef.get();
  if (!snap.exists)
    throw new functions.https.HttpsError("not-found", "Task not found.");

  const t = snap.data()!;
  if (t.uid !== uid)
    throw new functions.https.HttpsError("permission-denied", "Not your task.");
  if (t.status === "completed")
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Cannot delete completed task.",
    );

  await taskRef.delete();
  return { ok: true };
});

/** Callable: startSession */
export const startSession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const taskId = data?.taskId;
  assertNonEmptyString(taskId, "taskId", 200);

  const clientMeta = data?.clientMeta ?? {};

  const taskRef = db.doc(`tasks/${taskId}`);

  const sessionId = await db.runTransaction(async (tx) => {
    const taskSnap = await tx.get(taskRef);
    if (!taskSnap.exists)
      throw new functions.https.HttpsError("not-found", "Task not found.");

    const task = taskSnap.data()!;
    if (task.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your task.",
      );
    if (["completed", "missed", "canceled"].includes(task.status)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Cannot start session for task in status ${task.status}.`,
      );
    }
    if (task.activeSessionId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Task already has an active session.",
      );
    }

    const sessionRef = db.collection("sessions").doc();

    tx.set(sessionRef, {
      uid,
      taskId,
      plannedMinutes: task.estimateMinutes ?? 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      endedAt: null,
      status: "started",
      clientMeta: {
        platform: clientMeta.platform ?? null,
        appVersion: clientMeta.appVersion ?? null,
      },
    });

    tx.update(taskRef, {
      status: "active",
      activeSessionId: sessionRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(db.doc(`users/${uid}`), {
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return sessionRef.id;
  });

  return { sessionId };
});

/** Callable: endSession (awards points + completes task) */
export const endSession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);

  const sessionId = data?.sessionId;
  assertNonEmptyString(sessionId, "sessionId", 200);

  const sessionRef = db.doc(`sessions/${sessionId}`);

  await db.runTransaction(async (tx) => {
    const sessionSnap = await tx.get(sessionRef);
    if (!sessionSnap.exists)
      throw new functions.https.HttpsError("not-found", "Session not found.");

    const session = sessionSnap.data()!;
    if (session.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your session.",
      );
    if (session.status !== "started")
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Session already ended.",
      );

    const userRef = db.doc(`users/${uid}`);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists)
      throw new functions.https.HttpsError("internal", "User profile missing.");

    const user = userSnap.data()!;
    const tz = user.timezone ?? "Europe/Berlin";

    const taskRef = db.doc(`tasks/${session.taskId}`);
    const taskSnap = await tx.get(taskRef);
    if (!taskSnap.exists)
      throw new functions.https.HttpsError("not-found", "Task not found.");

    const task = taskSnap.data()!;
    if (task.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your task.",
      );

    const startedAt: admin.firestore.Timestamp | null =
      session.startedAt ?? null;
    if (!startedAt)
      throw new functions.https.HttpsError(
        "internal",
        "Session startedAt missing.",
      );

    const endedAt = admin.firestore.Timestamp.now();

    // Anti-abuse cap (12h)
    const maxMs = 12 * 60 * 60 * 1000;
    const durationMs = endedAt.toMillis() - startedAt.toMillis();
    if (durationMs < 0 || durationMs > maxMs) {
      tx.update(sessionRef, { status: "invalid", endedAt });
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Invalid session duration.",
      );
    }

    const actualMinutes = Math.max(0, Math.floor(durationMs / 60000));
    const plannedMinutes = Number(
      session.plannedMinutes ?? task.estimateMinutes ?? 0,
    );

    const bonusEligible =
      !!task.endAt && endedAt.toMillis() <= task.endAt.toMillis();
    const award = computeAwardPoints(
      plannedMinutes,
      actualMinutes,
      bonusEligible,
    );

    const weekId = isoWeekIdFromMillis(endedAt.toMillis(), tz);
    const weekPeriod = weekPeriodId(weekId);

    // End session
    tx.update(sessionRef, { endedAt, status: "ended" });

    // Complete task
    tx.update(taskRef, {
      status: "completed",
      activeSessionId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Point event
    const eventRef = db.collection("pointEvents").doc();
    tx.set(eventRef, {
      uid,
      type: "TASK_COMPLETED",
      taskId: taskRef.id,
      sessionId: sessionRef.id,
      pointsDelta: award,
      weekId,
      reason: `Completed session (${actualMinutes} min)`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Weekly rollover
    const currentWeekId = user.currentWeekId ?? null;
    const baseWeekly =
      currentWeekId && currentWeekId === weekId
        ? Number(user.weeklyPoints ?? 0)
        : 0;

    const newWeeklyPoints = baseWeekly + award;
    const newTotalPoints = Number(user.totalPoints ?? 0) + award;

    tx.update(userRef, {
      weeklyPoints: newWeeklyPoints,
      totalPoints: newTotalPoints,
      currentWeekId: weekId,
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Leaderboards
    tx.set(
      leaderboardEntryRef("global_alltime", uid),
      {
        uid,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        points: newTotalPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(
      leaderboardEntryRef(weekPeriod, uid),
      {
        uid,
        displayName: user.displayName ?? null,
        photoURL: user.photoURL ?? null,
        points: newWeeklyPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return { ok: true };
});

/** Callable: getLeaderboard */
export const getLeaderboard = functions.https.onCall(async (data, context) => {
  requireAuth(context);

  const periodId = data?.periodId;
  const limit =
    typeof data?.limit === "number"
      ? Math.min(Math.max(data.limit, 1), 100)
      : 50;

  if (typeof periodId !== "string" || !periodId.trim()) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "periodId is required.",
    );
  }

  const snap = await db
    .collection(`leaderboards/${periodId}/entries`)
    .orderBy("points", "desc")
    .limit(limit)
    .get();

  return { entries: snap.docs.map((d) => d.data()) };
});

/** Scheduled: markMissedTasks (every 10 minutes) */
export const markMissedTasks = functions.pubsub
  .schedule("*/10 * * * *")
  .timeZone("UTC")
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const penalty = missedTaskPenalty();

    const overdueSnap = await db
      .collection("tasks")
      .where("status", "in", ["planned", "active"])
      .where("endAt", "<=", now)
      .limit(200)
      .get();

    if (overdueSnap.empty) return null;

    for (const doc of overdueSnap.docs) {
      const taskRef = doc.ref;

      await db.runTransaction(async (tx) => {
        const fresh = await tx.get(taskRef);
        if (!fresh.exists) return;

        const t = fresh.data()!;
        if (!["planned", "active"].includes(t.status)) return;

        const uid = t.uid as string;

        const userRef = db.doc(`users/${uid}`);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists) return;

        const user = userSnap.data()!;
        const tz = user.timezone ?? "Europe/Berlin";

        const weekId = isoWeekIdFromMillis(now.toMillis(), tz);
        const weekPeriod = weekPeriodId(weekId);

        // Mark missed
        tx.update(taskRef, {
          status: "missed",
          activeSessionId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Point event
        const eventRef = db.collection("pointEvents").doc();
        tx.set(eventRef, {
          uid,
          type: "TASK_MISSED",
          taskId: taskRef.id,
          sessionId: null,
          pointsDelta: penalty,
          weekId,
          reason: "Task missed (overdue)",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Weekly rollover
        const currentWeekId = user.currentWeekId ?? null;
        const baseWeekly =
          currentWeekId && currentWeekId === weekId
            ? Number(user.weeklyPoints ?? 0)
            : 0;

        const newWeeklyPoints = baseWeekly + penalty;
        const newTotalPoints = Number(user.totalPoints ?? 0) + penalty;

        tx.update(userRef, {
          weeklyPoints: newWeeklyPoints,
          totalPoints: newTotalPoints,
          currentWeekId: weekId,
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Leaderboards
        tx.set(
          leaderboardEntryRef("global_alltime", uid),
          {
            uid,
            displayName: user.displayName ?? null,
            photoURL: user.photoURL ?? null,
            points: newTotalPoints,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        tx.set(
          leaderboardEntryRef(weekPeriod, uid),
          {
            uid,
            displayName: user.displayName ?? null,
            photoURL: user.photoURL ?? null,
            points: newWeeklyPoints,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      });
    }

    return null;
  });

// ------------------------
// V2 exports (additive)
// ------------------------
export {
  onUserCreateV2,
  createTaskV2,
  startSessionV2,
  heartbeatV2,
  endSessionV2,
  deleteAccountV2,
} from "./v2/functions";
export { weeklyLeagueResetJobV2 } from "./v2/weeklyReset";
export { migrateUsersV2 } from "./v2/migrate";
