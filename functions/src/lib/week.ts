import { DateTime } from "luxon";

export function isoWeekIdFromMillis(ms: number, timezone: string): string {
  const dt = DateTime.fromMillis(ms, { zone: timezone });
  const weekYear = dt.weekYear;
  const weekNumber = String(dt.weekNumber).padStart(2, "0");
  return `${weekYear}-W${weekNumber}`; // e.g. 2026-W08
}

export function weekPeriodId(weekId: string): string {
  // "2026-W08" -> "week_2026_W08"
  return `week_${weekId.replace("-", "_")}`;
}
