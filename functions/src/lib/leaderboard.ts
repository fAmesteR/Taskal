import * as admin from "firebase-admin";

export function leaderboardEntryRef(periodId: string, uid: string) {
  return admin.firestore().doc(`leaderboards/${periodId}/entries/${uid}`);
}
