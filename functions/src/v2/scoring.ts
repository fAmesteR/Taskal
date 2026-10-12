import {
  CATEGORY_MULTIPLIER,
  DIFFICULTY_MULTIPLIER,
  DAILY_CAP_MINUTES,
  COMPLETION_RATIO_REQUIRED,
  INTEGRITY_THRESHOLD,
  MIN_SESSION_MINUTES,
  streakMultiplier,
  Category,
  Difficulty,
} from "./constants";

export type IntegrityInputs = {
  blockedAppSeconds: number;
  pauseSeconds: number;
  appKilled?: boolean;
  timeManipulation?: boolean;
};

export function computeIntegrity(
  durationSeconds: number,
  inputs: IntegrityInputs,
): number {
  const dur = Math.max(1, durationSeconds);
  const blockedRatio = Math.max(0, inputs.blockedAppSeconds) / dur;

  // pause penalty: proportional, capped
  const pauseRatio = Math.max(0, inputs.pauseSeconds) / dur;
  const pausePenalty = Math.min(0.25, pauseRatio); // simple MVP

  const integrity = 1 - blockedRatio - pausePenalty;
  return Math.max(0, Math.min(1, integrity));
}

export function isScoreEligible(params: {
  actualMinutes: number;
  plannedMinutes: number;
  integrity: number;
  appKilled?: boolean;
  timeManipulation?: boolean;
}): { ok: boolean; reason: "invalid" | "failed" | "ok" } {
  if (params.appKilled || params.timeManipulation)
    return { ok: false, reason: "invalid" };
  if (params.actualMinutes < MIN_SESSION_MINUTES)
    return { ok: false, reason: "failed" };
  const ratio =
    params.plannedMinutes > 0
      ? params.actualMinutes / params.plannedMinutes
      : 0;
  if (ratio < COMPLETION_RATIO_REQUIRED) return { ok: false, reason: "failed" };
  if (params.integrity < INTEGRITY_THRESHOLD)
    return { ok: false, reason: "failed" };
  return { ok: true, reason: "ok" };
}

export function applyDailyCap(
  alreadyRewardedToday: number,
  actualMinutes: number,
): {
  rewardableMinutes: number;
  newRewardedToday: number;
} {
  const remaining = Math.max(
    0,
    DAILY_CAP_MINUTES - Math.max(0, alreadyRewardedToday),
  );
  const rewardable = Math.min(actualMinutes, remaining);
  return {
    rewardableMinutes: rewardable,
    newRewardedToday: Math.max(0, alreadyRewardedToday) + rewardable,
  };
}

export function computeFinalScore(params: {
  rewardableMinutes: number;
  category: Category;
  difficulty: Difficulty;
  integrity: number;
  streakDays: number;
}): {
  basePoints: number;
  finalScore: number;
  categoryMultiplier: number;
  difficultyMultiplier: number;
  streakMultiplier: number;
} {
  const basePoints = params.rewardableMinutes * 10;
  const catMul = CATEGORY_MULTIPLIER[params.category];
  const diffMul = DIFFICULTY_MULTIPLIER[params.difficulty];
  const stMul = streakMultiplier(params.streakDays);

  const raw = basePoints * catMul * params.integrity * diffMul * stMul;
  const finalScore = Math.floor(raw);

  return {
    basePoints,
    finalScore,
    categoryMultiplier: catMul,
    difficultyMultiplier: diffMul,
    streakMultiplier: stMul,
  };
}
