import { HttpsError } from "firebase-functions/v1/https";

export function requireAuth(context: any): string {
  const uid = context?.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  return uid;
}
