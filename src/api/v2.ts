import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type V2Category = "Study" | "DeepWork" | "Workout" | "Reading" | "Admin";
export type V2Difficulty = "Normal" | "DeepFocus";

export type CreateTaskV2Input = {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string | null; // HH:mm or null
  durationMinutes: number; // >= 20
  category: V2Category;
  difficulty: V2Difficulty;
  notes?: string;
};

export async function createTaskV2(
  input: CreateTaskV2Input,
): Promise<{ taskId: string }> {
  const fn = httpsCallable(functions, "createTaskV2");
  const res = await fn(input);
  return res.data as { taskId: string };
}
