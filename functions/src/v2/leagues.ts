import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import { LeagueTier, promoteTier, demoteTier, LEAGUE_ORDER } from "./constants";

export type CurrentWeek = {
  weekId: string;
  startsAt: admin.firestore.Timestamp;
  endsAt: admin.firestore.Timestamp;
  status: "active" | "processing" | "archived";
};

export function currentWeekRef(db: admin.firestore.Firestore) {
  return db.doc("leagues/currentWeek");
}

export function weekScoresEntryRef(
  db: admin.firestore.Firestore,
  weekId: string,
  tier: LeagueTier,
  uid: string,
) {
  return db.doc(`weeklyScores/${weekId}/leagues/${tier}/entries/${uid}`);
}

export async function getOrInitCurrentWeek(
  db: admin.firestore.Firestore,
): Promise<CurrentWeek> {
  const ref = currentWeekRef(db);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as CurrentWeek;

  // Initialize week based on ISO week in UTC
  const now = DateTime.utc();
  const weekId = `${now.weekYear}-W${String(now.weekNumber).padStart(2, "0")}`;
  const starts = now.startOf("week"); // Monday 00:00 ISO
  const ends = starts.plus({ days: 7 });

  const doc: CurrentWeek = {
    weekId,
    startsAt: admin.firestore.Timestamp.fromMillis(starts.toMillis()),
    endsAt: admin.firestore.Timestamp.fromMillis(ends.toMillis()),
    status: "active",
  };

  await ref.set(doc, { merge: true });
  return doc;
}

export function computePromotionDemotion(
  uidsOrdered: string[],
): Map<string, "promote" | "demote" | "stay"> {
  const n = uidsOrdered.length;
  const topCount = Math.ceil(n * 0.2);
  const bottomCount = Math.ceil(n * 0.2);

  const result = new Map<string, "promote" | "demote" | "stay">();
  uidsOrdered.forEach((uid, idx) => {
    if (idx < topCount) result.set(uid, "promote");
    else if (idx >= n - bottomCount) result.set(uid, "demote");
    else result.set(uid, "stay");
  });
  return result;
}

export function nextTier(
  tier: LeagueTier,
  move: "promote" | "demote" | "stay",
): LeagueTier {
  if (move === "promote") return promoteTier(tier);
  if (move === "demote") return demoteTier(tier);
  return tier;
}

export function allTiers(): LeagueTier[] {
  return [...LEAGUE_ORDER];
}
