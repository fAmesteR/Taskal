export type Category = "Study" | "DeepWork" | "Workout" | "Reading" | "Admin";
export type Difficulty = "Normal" | "DeepFocus";
export type TaskStatus = "Planned" | "Running" | "Completed" | "Failed";
export type SessionStatus = "started" | "ended" | "failed" | "invalid";
export type LeagueTier = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";

export const CATEGORY_MULTIPLIER: Record<Category, number> = {
  Study: 1.2,
  DeepWork: 1.3,
  Workout: 1.1,
  Reading: 1.0,
  Admin: 0.9,
};

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  Normal: 1.0,
  DeepFocus: 1.2,
};

export function streakMultiplier(streakDays: number): number {
  if (streakDays >= 15) return 1.15;
  if (streakDays >= 8) return 1.1;
  if (streakDays >= 4) return 1.05;
  return 1.0;
}

export const MIN_SESSION_MINUTES = 20;
export const COMPLETION_RATIO_REQUIRED = 0.9;
export const INTEGRITY_THRESHOLD = 0.75;
export const DAILY_CAP_MINUTES = 360;

export const LEAGUE_ORDER: LeagueTier[] = [
  "Bronze",
  "Silver",
  "Gold",
  "Platinum",
  "Diamond",
];

export function promoteTier(t: LeagueTier): LeagueTier {
  const i = LEAGUE_ORDER.indexOf(t);
  return i < LEAGUE_ORDER.length - 1 ? LEAGUE_ORDER[i + 1] : t;
}

export function demoteTier(t: LeagueTier): LeagueTier {
  const i = LEAGUE_ORDER.indexOf(t);
  return i > 0 ? LEAGUE_ORDER[i - 1] : t;
}
