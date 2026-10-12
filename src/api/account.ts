import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

/** GDPR erasure: wipes all server-side data + the Firebase Auth account. */
export async function deleteAccountV2(): Promise<{ ok: true }> {
  const fn = httpsCallable(functions, "deleteAccountV2");
  const res = await fn({});
  return res.data as { ok: true };
}
