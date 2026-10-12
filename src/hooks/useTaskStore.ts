import { useState, useEffect, useCallback } from "react";
import {
  Task,
  TaskCategory,
  TaskDifficulty,
  UserStats,
  POINTS,
} from "@/types/task";
import { createTaskV2 } from "@/api/v2";

const TASKS_KEY = "focusplanner_tasks";
const STATS_KEY = "focusplanner_stats";

const defaultStats: UserStats = {
  points: 0,
  currentStreak: 0,
  longestStreak: 0,
  totalFocusMinutes: 0,
  totalTasksCompleted: 0,
  lastActiveDate: null,
};

function loadTasks(): Task[] {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadStats(): UserStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : { ...defaultStats };
  } catch {
    return { ...defaultStats };
  }
}

function saveTasks(tasks: Task[]) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function saveStats(stats: UserStats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function useTaskStore() {
  const [tasks, setTasks] = useState<Task[]>(loadTasks);
  const [stats, setStats] = useState<UserStats>(loadStats);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // ---------------------------
  // V1: local-only addTask (unchanged)
  // ---------------------------
  const addTask = useCallback(
    (
      task: Omit<
        Task,
        "id" | "status" | "elapsedSeconds" | "createdAt" | "updatedAt"
      >,
    ) => {
      const now = new Date().toISOString();
      const newTask: Task = {
        ...task,
        id: generateId(),
        status: "planned",
        elapsedSeconds: 0,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [],
  );

  // ---------------------------
  // V2: server-backed addTaskV2 — duration is derived from the start→end
  // window by the form; the backend requires 20–480 minutes.
  // ---------------------------
  const addTaskV2 = useCallback(
    async (
      task: Omit<
        Task,
        "id" | "status" | "elapsedSeconds" | "createdAt" | "updatedAt"
      > & { durationMinutes?: number; notes?: string },
    ) => {
      const now = new Date().toISOString();

      const title = task.title.trim();
      if (!title) throw new Error("title required");

      const date = task.date || getTodayStr();
      const startTime = task.startTime ?? null;

      const raw = Number(task.durationMinutes ?? task.estimatedMinutes);
      if (!Number.isFinite(raw)) throw new Error("duration required");
      const safeDurationMinutes = Math.min(480, Math.max(20, Math.floor(raw)));

      const category = task.category ?? "Study";
      const difficulty = task.difficulty ?? "Normal";

      // 1) Server create
      const { taskId } = await createTaskV2({
        title,
        date,
        startTime,
        durationMinutes: safeDurationMinutes,
        category,
        difficulty,
        notes: task.notes,
      });

      // 2) Local add (use server id; keep local timer consistent with
      // the server-accepted minutes)
      const newTask: Task = {
        ...task,
        title,
        id: taskId,
        status: "planned",
        elapsedSeconds: 0,
        createdAt: now,
        updatedAt: now,
        estimatedMinutes: safeDurationMinutes,
      };

      setTasks((prev) => [...prev, newTask]);
      return newTask;
    },
    [],
  );

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, ...updates, updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const startTask = useCallback(
    (id: string) => {
      updateTask(id, { status: "running" });
      setStats((prev) => ({
        ...prev,
        points: prev.points + POINTS.START_TASK,
      }));
    },
    [updateTask],
  );

  // Open-ended "quick focus": starts immediately, counts up, no planned end.
  const startQuickFocus = useCallback(
    (category: TaskCategory = "DeepWork", difficulty: TaskDifficulty = "Normal") => {
      const now = new Date().toISOString();
      const task: Task = {
        id: generateId(),
        title: `${category === "DeepWork" ? "Deep Work" : category} session`,
        date: getTodayStr(),
        estimatedMinutes: 0,
        openEnded: true,
        category,
        difficulty,
        status: "running",
        elapsedSeconds: 0,
        createdAt: now,
        updatedAt: now,
      };
      setTasks((prev) => [...prev, task]);
      setStats((prev) => ({
        ...prev,
        points: prev.points + POINTS.START_TASK,
      }));
      return task;
    },
    [],
  );

  const completeTask = useCallback(
    (id: string) => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;

      updateTask(id, { status: "done" });

      const today = getTodayStr();
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      const focusMinutes = Math.round(task.elapsedSeconds / 60);

      setStats((prev) => {
        let newStreak = prev.currentStreak;
        if (prev.lastActiveDate === yesterday || prev.lastActiveDate === null) {
          newStreak = prev.currentStreak + 1;
        } else if (prev.lastActiveDate !== today) {
          newStreak = 1;
        }

        let pointsEarned =
          POINTS.COMPLETE + (newStreak > 1 ? POINTS.STREAK_BONUS : 0);

        // On-time bonus: completed within scheduled window
        if (task.startTime && task.endTime) {
          const now = new Date();
          const [eh, em] = task.endTime.split(":").map(Number);
          const endDate = new Date();
          endDate.setHours(eh, em, 0);
          if (now <= endDate) pointsEarned += POINTS.ON_TIME_BONUS;
        }

        return {
          ...prev,
          points: prev.points + pointsEarned,
          currentStreak: newStreak,
          longestStreak: Math.max(prev.longestStreak, newStreak),
          totalFocusMinutes: prev.totalFocusMinutes + focusMinutes,
          totalTasksCompleted: prev.totalTasksCompleted + 1,
          lastActiveDate: today,
        };
      });
    },
    [tasks, updateTask],
  );

  const failTask = useCallback(
    (id: string) => {
      updateTask(id, { status: "failed" });
      setStats((prev) => ({
        ...prev,
        points: Math.max(0, prev.points + POINTS.QUIT_EARLY),
      }));
    },
    [updateTask],
  );

  const getTasksForDate = useCallback(
    (date: string) => {
      return tasks.filter((t) => t.date === date);
    },
    [tasks],
  );

  const getTodayTasks = useCallback(() => {
    return getTasksForDate(getTodayStr());
  }, [getTasksForDate]);

  const getRunningTask = useCallback(() => {
    return tasks.find((t) => t.status === "running") || null;
  }, [tasks]);

  return {
    tasks,
    stats,

    // V1
    addTask,
    updateTask,
    deleteTask,
    startTask,
    startQuickFocus,
    completeTask,
    failTask,

    // selectors
    getTasksForDate,
    getTodayTasks,
    getRunningTask,

    // V2 additive
    addTaskV2,
  };
}
