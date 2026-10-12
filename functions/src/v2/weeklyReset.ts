import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import { DateTime } from "luxon";
import {
  allTiers,
  computePromotionDemotion,
  currentWeekRef,
  getOrInitCurrentWeek,
  nextTier,
  weekScoresEntryRef,
} from "./leagues";
import { LeagueTier } from "./constants";

const db = admin.firestore();

/**
 * Weekly reset (V2)
 * - Runs Monday 00:05 UTC
 * - For each tier: rank users by weeklyScore, promote top 20%, demote bottom 20%
 * - Updates users/{uid}.leagueTier
 * - Resets users weeklyScore & weeklyFocusMinutes
 * - Creates new currentWeek
 *
 * MVP scaling note:
 * - This reads ALL entries for each tier for the week.
 * - Fine for MVP/early scale; for large scale you'll paginate and/or process with Cloud Tasks.
 */
export const weeklyLeagueResetJobV2 = functions.pubsub
  .schedule("5 0 * * 1")
  .timeZone("UTC")
  .onRun(async () => {
    const current = await getOrInitCurrentWeek(db);
    const weekId = current.weekId;

    // Mark processing
    await currentWeekRef(db).set({ status: "processing" }, { merge: true });

    for (const tier of allTiers()) {
      const entriesSnap = await db
        .collection(`weeklyScores/${weekId}/leagues/${tier}/entries`)
        .orderBy("weeklyScore", "desc")
        .get();

      if (entriesSnap.empty) continue;

      const uidsOrdered = entriesSnap.docs.map((d) => d.id);
      const moves = computePromotionDemotion(uidsOrdered);

      // Batch user updates
      const batches: admin.firestore.WriteBatch[] = [];
      let batch = db.batch();
      let opCount = 0;

      for (const uid of uidsOrdered) {
        const move = moves.get(uid) ?? "stay";
        const newTier = nextTier(tier as LeagueTier, move);

        const userRef = db.doc(`users/${uid}`);

        batch.set(
          userRef,
          {
            leagueTier: newTier,
            weeklyScore: 0,
            weeklyFocusMinutes: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        opCount++;
        if (opCount >= 400) {
          batches.push(batch);
          batch = db.batch();
          opCount = 0;
        }
      }

      if (opCount > 0) batches.push(batch);
      for (const b of batches) await b.commit();
    }

    // Archive old week and create new week doc
    const now = DateTime.utc();
    const newWeekId = `${now.weekYear}-W${String(now.weekNumber).padStart(2, "0")}`;
    const starts = now.startOf("week");
    const ends = starts.plus({ days: 7 });

    await currentWeekRef(db).set(
      {
        weekId: newWeekId,
        startsAt: admin.firestore.Timestamp.fromMillis(starts.toMillis()),
        endsAt: admin.firestore.Timestamp.fromMillis(ends.toMillis()),
        status: "active",
      },
      { merge: true },
    );

    return null;
  });
