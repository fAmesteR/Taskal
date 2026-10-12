export type TaskStatus = 'planned' | 'running' | 'done' | 'failed';

export type TaskCategory = 'Study' | 'DeepWork' | 'Workout' | 'Reading' | 'Admin';
export type TaskDifficulty = 'Normal' | 'DeepFocus';

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  estimatedMinutes: number;
  /** Open-ended "quick focus" session: counts up, no planned duration */
  openEnded?: boolean;
  category?: TaskCategory;
  difficulty?: TaskDifficulty;
  status: TaskStatus;
  elapsedSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserStats {
  points: number;
  currentStreak: number;
  longestStreak: number;
  totalFocusMinutes: number;
  totalTasksCompleted: number;
  lastActiveDate: string | null;
}

export const POINTS = {
  START_TASK: 1,
  COMPLETE: 10,
  ON_TIME_BONUS: 5,
  QUIT_EARLY: -8,
  STREAK_BONUS: 2,
} as const;
