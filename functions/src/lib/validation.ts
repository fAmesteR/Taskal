import { HttpsError } from "firebase-functions/v1/https";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertNonEmptyString(v: any, field: string, maxLen = 120) {
  if (typeof v !== "string" || !v.trim()) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be a non-empty string.`,
    );
  }
  if (v.trim().length > maxLen) {
    throw new HttpsError(
      "invalid-argument",
      `${field} is too long (max ${maxLen}).`,
    );
  }
}

export function assertOptionalString(v: any, field: string, maxLen = 500) {
  if (v == null) return;
  if (typeof v !== "string")
    throw new HttpsError("invalid-argument", `${field} must be a string.`);
  if (v.length > maxLen)
    throw new HttpsError(
      "invalid-argument",
      `${field} is too long (max ${maxLen}).`,
    );
}

export function assertDate(v: any, field: string) {
  if (typeof v !== "string" || !DATE_RE.test(v)) {
    throw new HttpsError("invalid-argument", `${field} must be YYYY-MM-DD.`);
  }
}

export function assertTime(v: any, field: string) {
  if (typeof v !== "string" || !TIME_RE.test(v)) {
    throw new HttpsError(
      "invalid-argument",
      `${field} must be HH:mm (00:00–23:59).`,
    );
  }
}

export function assertEstimateMinutes(v: any) {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 24 * 60) {
    throw new HttpsError(
      "invalid-argument",
      `estimateMinutes must be between 1 and 1440.`,
    );
  }
}
