import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { DateTime } from "luxon";
import { requireAuth } from "../lib/auth";
type Category = "Study" | "DeepWork" | "Workout" | "Reading" | "Admin";
type Difficulty = "Normal" | "DeepFocus";
type LeagueTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
const db = admin.firestore();
const CATEGORY_MULT: Record<Category, number> = {
  Study: 1.2,
  DeepWork: 1.3,
  Workout: 1.1,
  Reading: 1.0,
  Admin: 0.9,
};
const DIFF_MULT: Record<Difficulty, number> = {
  Normal: 1.0,
  DeepFocus: 1.2,
};
const MIN_SESSION_MIN = 20;
const DAILY_CAP_MIN = 360;
const INTEGRITY_THRESHOLD = 0.75;
const COMPLETION_RATIO = 0.9;
// Relaxed session checks for fast dev testing — only in the local emulator, never in production
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
function streakMult(streakDays: number): number {
  if (streakDays >= 15) return 1.15;
  if (streakDays >= 8) return 1.1;
  if (streakDays >= 4) return 1.05;
  return 1.0;
}
function isoWeekIdUTC(): string {
  const now = DateTime.utc();
  return `${now.weekYear}-W${String(now.weekNumber).padStart(2, "0")}`;
}
async function ensureCurrentWeek(): Promise<string> {
  const ref = db.doc("leagues/currentWeek");
  const snap = await ref.get();
  if (snap.exists) return (snap.data() as any).weekId as string;
  const weekId = isoWeekIdUTC();
  const starts = DateTime.utc().startOf("week");
  const ends = starts.plus({ days: 7 });
  await ref.set(
    {
      weekId,
      startsAt: admin.firestore.Timestamp.fromMillis(starts.toMillis()),
      endsAt: admin.firestore.Timestamp.fromMillis(ends.toMillis()),
      status: "active",
    },
    { merge: true },
  );
  return weekId;
}
function localDateString(tsMillis: number, timezone: string): string {
  return DateTime.fromMillis(tsMillis, { zone: timezone }).toISODate()!;
}
function computeIntegrity(
  durationSec: number,
  blockedSec: number,
  pauseSec: number,
): number {
  const d = Math.max(1, durationSec);
  const blockedRatio = Math.max(0, blockedSec) / d;
  const pauseRatio = Math.max(0, pauseSec) / d;
  const pausePenalty = Math.min(0.25, pauseRatio);
  return Math.max(0, Math.min(1, 1 - blockedRatio - pausePenalty));
}
function requireCategory(v: any): Category {
  const allowed: Category[] = [
    "Study",
    "DeepWork",
    "Workout",
    "Reading",
    "Admin",
  ];
  if (!allowed.includes(v))
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid category",
    );
  return v;
}
function requireDifficulty(v: any): Difficulty {
  const allowed: Difficulty[] = ["Normal", "DeepFocus"];
  if (!allowed.includes(v))
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid difficulty",
    );
  return v;
}
// Client-supplied ids get interpolated into Firestore doc paths — a "/" would
// add path segments and point the ref elsewhere. Reject anything but a plain id.
function requirePlainId(v: any, field: string): string {
  const s = String(v ?? "").trim();
  if (!s || s.length > 200 || s.includes("/"))
    throw new functions.https.HttpsError(
      "invalid-argument",
      `${field} invalid`,
    );
  return s;
}
export const onUserCreateV2 = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const username =
    user.displayName && user.displayName.trim()
      ? user.displayName.trim()
      : `user_${uid.slice(0, 6)}`;
  await db.doc(`users/${uid}`).set(
    {
      username,
      avatarUrl: user.photoURL ?? null,
      leagueTier: "Bronze",
      streakDays: 0,
      weeklyFocusMinutes: 0,
      weeklyScore: 0,
      dailyRewardedMinutes: { date: null, minutes: 0 },
      lastSessionCompletedAt: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
});
export const createTaskV2 = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const title = String(data?.title ?? "").trim();
  if (!title)
    throw new functions.https.HttpsError("invalid-argument", "title required");
  const date = String(data?.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "date must be YYYY-MM-DD",
    );
  }
  const durationMinutes = Number(data?.durationMinutes ?? 0);
  if (
    !Number.isFinite(durationMinutes) ||
    durationMinutes < MIN_SESSION_MIN ||
    durationMinutes > 1440
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "durationMinutes invalid",
    );
  }
  const category = requireCategory(data?.category);
  const difficulty = requireDifficulty(data?.difficulty);
  const startTime = data?.startTime ? String(data.startTime) : null;
  const userSnap = await db.doc(`users/${uid}`).get();
  const tz = (userSnap.data() as any)?.timezone ?? "Europe/Berlin";
  let startAt: admin.firestore.Timestamp | null = null;
  let endAt: admin.firestore.Timestamp | null = null;
  if (startTime) {
    const dt = DateTime.fromISO(`${date}T${startTime}`, { zone: tz });
    startAt = admin.firestore.Timestamp.fromMillis(dt.toMillis());
    endAt = admin.firestore.Timestamp.fromMillis(
      dt.plus({ minutes: durationMinutes }).toMillis(),
    );
  }
  const ref = db.collection("tasks").doc();
  await ref.set({
    uid,
    title,
    date,
    startTime,
    durationMinutes,
    category,
    difficulty,
    status: "Planned",
    startAt,
    endAt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { taskId: ref.id };
});
export const startSessionV2 = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const taskId = data?.taskId ? requirePlainId(data.taskId, "taskId") : null;
  const sessionRef = db.collection("sessions").doc();
  await db.runTransaction(async (tx) => {
    let category: Category;
    let difficulty: Difficulty;
    let plannedMinutes: number;
    if (taskId) {
      const taskRef = db.doc(`tasks/${taskId}`);
      const tSnap = await tx.get(taskRef);
      if (!tSnap.exists)
        throw new functions.https.HttpsError("not-found", "Task not found");
      const t = tSnap.data()!;
      if (t.uid !== uid)
        throw new functions.https.HttpsError(
          "permission-denied",
          "Not your task",
        );
      if (t.status !== "Planned")
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Task not Planned",
        );
      category = t.category;
      difficulty = t.difficulty;
      plannedMinutes = Number(t.durationMinutes ?? 0);
      if (plannedMinutes < MIN_SESSION_MIN)
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Task too short",
        );
      tx.update(taskRef, {
        status: "Running",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      category = requireCategory(data?.category);
      difficulty = requireDifficulty(data?.difficulty);
      plannedMinutes = Number(data?.plannedMinutes ?? 0);
      if (
        !Number.isFinite(plannedMinutes) ||
        plannedMinutes < MIN_SESSION_MIN ||
        plannedMinutes > 1440
      ) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "plannedMinutes invalid",
        );
      }
    }
    tx.set(sessionRef, {
      uid,
      taskId: taskId ?? null,
      category,
      difficulty,
      plannedMinutes,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      endedAt: null,
      status: "started",
      integrity: {
        blockedAppSeconds: 0,
        pauseSeconds: 0,
        switchCount: 0,
        appKilled: false,
        timeManipulation: false,
        integrityScore: 1.0,
      },
      score: {
        basePoints: 0,
        finalScore: 0,
        categoryMultiplier: CATEGORY_MULT[category],
        difficultyMultiplier: DIFF_MULT[difficulty],
        streakMultiplier: 1.0,
      },
      lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { sessionId: sessionRef.id };
});
export const heartbeatV2 = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const sessionId = requirePlainId(data?.sessionId, "sessionId");
  const blockedDelta = Number(data?.blockedAppSecondsDelta ?? 0);
  const pauseDelta = Number(data?.pauseSecondsDelta ?? 0);
  const switchDelta = Number(data?.switchCountDelta ?? 0);
  const appKilled = !!data?.appKilled;
  const ref = db.doc(`sessions/${sessionId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists)
      throw new functions.https.HttpsError("not-found", "Session not found");
    const s = snap.data()!;
    if (s.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your session",
      );
    if (s.status !== "started")
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Session not active",
      );
    const last = s.lastHeartbeatAt?.toMillis?.() ?? 0;
    const now = Date.now();
    if (last && now - last < 20_000)
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Too many heartbeats",
      );
    const integrity = s.integrity ?? {};
    tx.update(ref, {
      "integrity.blockedAppSeconds":
        Number(integrity.blockedAppSeconds ?? 0) + Math.max(0, blockedDelta),
      "integrity.pauseSeconds":
        Number(integrity.pauseSeconds ?? 0) + Math.max(0, pauseDelta),
      "integrity.switchCount":
        Number(integrity.switchCount ?? 0) + Math.max(0, switchDelta),
      "integrity.appKilled": integrity.appKilled || appKilled,
      lastHeartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});
export const endSessionV2 = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  const sessionId = requirePlainId(data?.sessionId, "sessionId");
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const sSnap = await tx.get(sessionRef);
    if (!sSnap.exists)
      throw new functions.https.HttpsError("not-found", "Session not found");
    const s = sSnap.data()!;
    if (s.uid !== uid)
      throw new functions.https.HttpsError(
        "permission-denied",
        "Not your session",
      );
    if (s.status !== "started")
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Session already ended",
      );
    const uSnap = await tx.get(userRef);
    if (!uSnap.exists)
      throw new functions.https.HttpsError("internal", "User missing");
    const u = uSnap.data()!;
    const tz = u.timezone ?? "Europe/Berlin";
    const startedAt: admin.firestore.Timestamp = s.startedAt;
    const endedAt = admin.firestore.Timestamp.now();
    const durationSec = Math.max(
      0,
      Math.floor((endedAt.toMillis() - startedAt.toMillis()) / 1000),
    );
    const actualMin = Math.max(0, Math.floor(durationSec / 60));
    const plannedMin = Math.max(0, Number(s.plannedMinutes ?? 0));
    const i = s.integrity ?? {};
    const integrityScore = computeIntegrity(
      durationSec,
      Number(i.blockedAppSeconds ?? 0),
      Number(i.pauseSeconds ?? 0),
    );
    // invalidation (everyone)
    if (i.appKilled || i.timeManipulation) {
      tx.update(sessionRef, {
        endedAt,
        status: "invalid",
        "integrity.integrityScore": integrityScore,
      });
      if (s.taskId) {
        tx.update(db.doc(`tasks/${s.taskId}`), {
          status: "Failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }
    const minMinutesRequired = IS_EMULATOR ? 1 : MIN_SESSION_MIN;
    const completionRequired = IS_EMULATOR ? 0 : COMPLETION_RATIO;
    const completion = plannedMin > 0 ? actualMin / plannedMin : 0;
    if (
      actualMin < minMinutesRequired ||
      completion < completionRequired ||
      integrityScore < INTEGRITY_THRESHOLD
    ) {
      tx.update(sessionRef, {
        endedAt,
        status: "failed",
        "integrity.integrityScore": integrityScore,
      });
      if (s.taskId) {
        tx.update(db.doc(`tasks/${s.taskId}`), {
          status: "Failed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return;
    }
    // daily cap
    const today = localDateString(endedAt.toMillis(), tz);
    const daily = u.dailyRewardedMinutes ?? { date: null, minutes: 0 };
    const already = daily.date === today ? Number(daily.minutes ?? 0) : 0;
    const remaining = Math.max(0, DAILY_CAP_MIN - already);
    const rewardableMin = Math.min(actualMin, remaining);
    const newRewarded = already + rewardableMin;
    // streak
    const lastStreakDate: string | null = u.lastStreakDate ?? null;
    const yesterday = localDateString(endedAt.toMillis() - 86400000, tz);
    let newStreakDays = Number(u.streakDays ?? 0);
    if (lastStreakDate === today) {
      // keep
    } else if (lastStreakDate === yesterday) {
      newStreakDays = newStreakDays + 1;
    } else {
      newStreakDays = 1;
    }
    const category: Category = s.category;
    const difficulty: Difficulty = s.difficulty;
    const basePoints = rewardableMin * 10;
    const finalScore = Math.floor(
      basePoints *
        CATEGORY_MULT[category] *
        integrityScore *
        DIFF_MULT[difficulty] *
        streakMult(newStreakDays),
    );
    // ensure week
    const weekId = await ensureCurrentWeek();
    const tier: LeagueTier = (u.leagueTier as LeagueTier) ?? "Bronze";
    const username = u.username ?? `user_${uid.slice(0, 6)}`;
    const avatarUrl = u.avatarUrl ?? null;
    tx.update(sessionRef, {
      endedAt,
      status: "ended",
      "integrity.integrityScore": integrityScore,
      score: {
        basePoints,
        finalScore,
        categoryMultiplier: CATEGORY_MULT[category],
        difficultyMultiplier: DIFF_MULT[difficulty],
        streakMultiplier: streakMult(newStreakDays),
      },
    });
    if (s.taskId) {
      tx.update(db.doc(`tasks/${s.taskId}`), {
        status: "Completed",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    const weeklyScore = Number(u.weeklyScore ?? 0) + finalScore;
    const weeklyFocusMinutes =
      Number(u.weeklyFocusMinutes ?? 0) + rewardableMin;
    tx.update(userRef, {
      weeklyScore,
      weeklyFocusMinutes,
      streakDays: newStreakDays,
      lastStreakDate: today,
      dailyRewardedMinutes: { date: today, minutes: newRewarded },
      lastSessionCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      db.doc(`weeklyScores/${weekId}/leagues/${tier}/entries/${uid}`),
      {
        uid,
        username,
        avatarUrl,
        weeklyScore,
        weeklyFocusMinutes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
  return { ok: true };
});

// GDPR "right to erasure": wipe every trace of the caller's own account —
// profile doc, tasks, sessions, point events, all public leaderboard entries,
// and finally the Firebase Auth record (their email). Server-side admin deletes
// bypass security rules and need no client reauth.
export const deleteAccountV2 = functions.https.onCall(async (_data, context) => {
  const uid = requireAuth(context);

  const deleteRefs = async (refs: admin.firestore.DocumentReference[]) => {
    // ponytail: chunk at 450, Firestore's per-batch ceiling is 500
    for (let i = 0; i < refs.length; i += 450) {
      const batch = db.batch();
      for (const ref of refs.slice(i, i + 450)) batch.delete(ref);
      await batch.commit();
    }
  };

  const deleteOwnedIn = async (coll: string) => {
    const snap = await db.collection(coll).where("uid", "==", uid).get();
    await deleteRefs(snap.docs.map((d) => d.ref));
  };

  await deleteOwnedIn("tasks");
  await deleteOwnedIn("sessions");
  await deleteOwnedIn("pointEvents");

  // Public leaderboard rows live under weeklyScores/*/leagues/*/entries/* and
  // leaderboards/*/entries/* — both subcollections named "entries" carrying a
  // uid field, so one collection-group query catches every week and tier.
  // ponytail: relies on Firestore's automatic single-field collection-group
  // index on entries.uid; if a "needs index" error surfaces post-deploy, add it.
  const entries = await db
    .collectionGroup("entries")
    .where("uid", "==", uid)
    .get();
  await deleteRefs(entries.docs.map((d) => d.ref));

  await db.doc(`users/${uid}`).delete();
  await admin.auth().deleteUser(uid);

  return { ok: true };
});
