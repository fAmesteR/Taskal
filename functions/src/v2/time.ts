import * as admin from "firebase-admin";
import { DateTime } from "luxon";

export function nowTs(): admin.firestore.Timestamp {
  return admin.firestore.Timestamp.now();
}

// local YYYY-MM-DD in the user's timezone
export function localDateString(tsMillis: number, timezone: string): string {
  return DateTime.fromMillis(tsMillis, { zone: timezone }).toISODate()!;
}

// Convert date + optional HH:mm into Firestore Timestamp in user TZ
export function toTimestamp(
  date: string,
  timeHHmm: string,
  timezone: string,
): admin.firestore.Timestamp {
  const dt = DateTime.fromISO(`${date}T${timeHHmm}`, { zone: timezone });
  return admin.firestore.Timestamp.fromMillis(dt.toMillis());
}

// ISO week id "YYYY-Www" using a chosen zone
export function isoWeekId(tsMillis: number, timezone: string): string {
  const dt = DateTime.fromMillis(tsMillis, { zone: timezone });
  const weekYear = dt.weekYear;
  const weekNumber = String(dt.weekNumber).padStart(2, "0");
  return `${weekYear}-W${weekNumber}`;
}
