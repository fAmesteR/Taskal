import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

const db = admin.firestore();

function defaultUsernameFromUid(uid: string) {
  return `user_${uid.slice(0, 6)}`;
}

/**
 * One-time migration to add missing V2 fields to existing users.
 * SECURITY: Admin only (set ADMIN_UID below).
 */
export const migrateUsersV2 = functions.https.onCall(async (_data, context) => {
  const callerUid = context.auth?.uid;
  if (!callerUid)
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Sign in required.",
    );

  // Admin gate via env config (set with: firebase functions:config or an
  // ADMIN_UID env var). Deny-by-default when unset — no hardcoded UID.
  const ADMIN_UID = process.env.ADMIN_UID;
  if (!ADMIN_UID || callerUid !== ADMIN_UID)
    throw new functions.https.HttpsError("permission-denied", "Admin only.");

  const snap = await db.collection("users").get();

  let updatedUsers = 0;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const u = doc.data();
    const patch: any = {};

    // Core V2 fields
    if (u.username == null)
      patch.username = u.displayName ?? defaultUsernameFromUid(doc.id);
    if (u.avatarUrl == null) patch.avatarUrl = u.photoURL ?? null;

    if (u.leagueTier == null) patch.leagueTier = "Bronze";
    if (u.streakDays == null) patch.streakDays = 0;
    if (u.lastStreakDate == null) patch.lastStreakDate = null;

    if (u.weeklyScore == null) patch.weeklyScore = 0;
    if (u.weeklyFocusMinutes == null) patch.weeklyFocusMinutes = 0;

    if (u.dailyRewardedMinutes == null)
      patch.dailyRewardedMinutes = { date: null, minutes: 0 };
    if (u.lastSessionCompletedAt == null) patch.lastSessionCompletedAt = null;

    // Keep existing timestamps as-is, just add updatedAt if missing
    if (u.updatedAt == null)
      patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    if (Object.keys(patch).length > 0) {
      batch.set(doc.ref, patch, { merge: true });
      updatedUsers++;
      ops++;

      // Firestore batch limit ~500; keep under 450 for safety
      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
  }

  if (ops > 0) await batch.commit();

  return { updatedUsers };
});
