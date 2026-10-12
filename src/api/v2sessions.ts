import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function startSessionV2(
  taskId: string,
): Promise<{ sessionId: string }> {
  const fn = httpsCallable(functions, "startSessionV2");
  const res = await fn({ taskId, clientMeta: { platform: "web" } });
  return res.data as { sessionId: string };
}

// Open-ended "quick focus" session — no task; the backend requires a
// plannedMinutes value, and 20 is its minimum, so the session earns points
// once at least 20 real minutes are focused (completion ratio ≥ 0.9).
export async function startQuickSessionV2(
  category: string,
  difficulty: string,
  plannedMinutes = 20, // pomodoro blocks pass their block length (server min 20)
): Promise<{ sessionId: string }> {
  const fn = httpsCallable(functions, "startSessionV2");
  const res = await fn({
    category,
    difficulty,
    plannedMinutes,
    clientMeta: { platform: "web" },
  });
  return res.data as { sessionId: string };
}

export async function endSessionV2(sessionId: string): Promise<{ ok: true }> {
  const fn = httpsCallable(functions, "endSessionV2");
  const res = await fn({ sessionId });
  return res.data as { ok: true };
}

export type HeartbeatV2Input = {
  sessionId: string;
  blockedAppSecondsDelta?: number;
  pauseSecondsDelta?: number;
  switchCountDelta?: number;
  appKilled?: boolean;
};

export async function heartbeatV2(
  input: HeartbeatV2Input,
): Promise<{ ok: true }> {
  const fn = httpsCallable(functions, "heartbeatV2");
  const res = await fn(input);
  return res.data as { ok: true };
}
