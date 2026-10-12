import * as admin from "firebase-admin";
import { DateTime } from "luxon";
import { HttpsError } from "firebase-functions/v1/https";

export function toTimestamp(
  date: string,
  time: string,
  timezone: string,
): admin.firestore.Timestamp {
  const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
  if (!dt.isValid)
    throw new HttpsError(
      "invalid-argument",
      "Invalid date/time/timezone combination.",
    );
  return admin.firestore.Timestamp.fromMillis(dt.toMillis());
}
