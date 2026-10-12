import { HttpsError } from "firebase-functions/v1/https";
import { Category, Difficulty } from "./constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function requireString(v: any, field: string, maxLen = 120): string {
  if (typeof v !== "string" || !v.trim())
    throw new HttpsError("invalid-argument", `${field} is required`);
  const s = v.trim();
  if (s.length > maxLen)
    throw new HttpsError("invalid-argument", `${field} too long`);
  return s;
}

export function optionalString(
  v: any,
  field: string,
  maxLen = 2000,
): string | undefined {
  if (v == null) return undefined;
  if (typeof v !== "string")
    throw new HttpsError("invalid-argument", `${field} must be string`);
  if (v.length > maxLen)
    throw new HttpsError("invalid-argument", `${field} too long`);
  return v;
}

export function requireDate(v: any, field: string): string {
  if (typeof v !== "string" || !DATE_RE.test(v))
    throw new HttpsError("invalid-argument", `${field} must be YYYY-MM-DD`);
  return v;
}

export function optionalTime(v: any, field: string): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !TIME_RE.test(v))
    throw new HttpsError("invalid-argument", `${field} must be HH:mm`);
  return v;
}

export function requireMinutes(
  v: any,
  field: string,
  min: number,
  max: number,
): number {
  if (typeof v !== "number" || !Number.isFinite(v))
    throw new HttpsError("invalid-argument", `${field} must be number`);
  if (v < min || v > max)
    throw new HttpsError("invalid-argument", `${field} out of range`);
  return Math.floor(v);
}

export function requireCategory(v: any): Category {
  const allowed: Category[] = [
    "Study",
    "DeepWork",
    "Workout",
    "Reading",
    "Admin",
  ];
  if (!allowed.includes(v))
    throw new HttpsError(
      "invalid-argument",
      `category must be one of ${allowed.join(", ")}`,
    );
  return v;
}

export function requireDifficulty(v: any): Difficulty {
  const allowed: Difficulty[] = ["Normal", "DeepFocus"];
  if (!allowed.includes(v))
    throw new HttpsError(
      "invalid-argument",
      `difficulty must be one of ${allowed.join(", ")}`,
    );
  return v;
}
