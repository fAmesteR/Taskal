import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Play, Zap, ChevronDown, CalendarDays } from "lucide-react";
import { useTaskStore } from "@/hooks/useTaskStore";
import { StatsBar } from "@/components/StatsBar";
import { DatePickerStrip } from "@/components/DatePickerStrip";
import { Calendar } from "@/components/ui/calendar";
import { TaskForm } from "@/components/TaskForm";
import { TaskList } from "@/components/TaskList";
import { FocusTimer } from "@/components/FocusTimer";
import {
  startSessionV2,
  startQuickSessionV2,
  endSessionV2,
} from "@/api/v2sessions";
import { TaskCategory } from "@/types/task";
import { Button } from "@/components/ui/button";
import { AvatarBadge } from "@/components/AvatarBadge";
import { loadAvatar } from "@/lib/avatar";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const QUICK_CATEGORIES: { value: TaskCategory; label: string; emoji: string }[] = [
  { value: "DeepWork", label: "Deep Work", emoji: "🧠" },
  { value: "Study",    label: "Study",     emoji: "📖" },
  { value: "Reading",  label: "Reading",   emoji: "📚" },
  { value: "Workout",  label: "Workout",   emoji: "🏋️" },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const Index = () => {
  const {
    stats,
    addTaskV2,
    startTask,
    startQuickFocus,
    completeTask,
    failTask,
    deleteTask,
    updateTask,
    getTasksForDate,
    getRunningTask,
  } = useTaskStore();

  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [quickCategory, setQuickCategory] = useState<TaskCategory>("DeepWork");

  const dayTasks = getTasksForDate(selectedDate);
  const runningTask = getRunningTask();

  const handleTick = useCallback(
    (id: string, elapsedSeconds: number) => { updateTask(id, { elapsedSeconds }); },
    [updateTask],
  );

  const handleSessionStart = useCallback(
    async (taskId: string, opts?: { blockMinutes?: number }) => {
      const running = getRunningTask();
      // Pomodoro blocks are standalone quick sessions so each block earns
      // points independently; the server task record is not completed by them.
      if (opts?.blockMinutes) {
        return startQuickSessionV2(
          running?.category ?? "DeepWork",
          running?.difficulty ?? "Normal",
          opts.blockMinutes,
        );
      }
      if (running?.id === taskId && running.openEnded) {
        return startQuickSessionV2(
          running.category ?? "DeepWork",
          running.difficulty ?? "Normal",
        );
      }
      return startSessionV2(taskId);
    },
    [getRunningTask],
  );

  const doneCount = dayTasks.filter((t) => t.status === "done").length;

  return (
    <div className="min-h-screen bg-background pb-28">

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "hsl(226 32% 5% / 0.82)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderBottom: "1px solid hsl(226 16% 14% / 0.7)",
          boxShadow: "0 1px 0 hsl(171 100% 47% / 0.06)",
        }}
      >
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
            <Target className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-bold tracking-tight text-gradient leading-none">
              Taskal
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Schedule · Focus · Level up
            </p>
          </div>
          <button
            onClick={() => navigate("/profile")}
            title="Your profile"
            className="transition-transform hover:scale-105 active:scale-95"
          >
            <AvatarBadge
              config={loadAvatar()}
              className="h-9 w-9 border border-primary/25"
              emojiClassName="text-lg"
            />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-5">

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <StatsBar stats={stats} />
        </motion.div>

        {/* Focus area */}
        {runningTask ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
          >
            <FocusTimer
              task={runningTask}
              onComplete={completeTask}
              onFail={failTask}
              onTick={handleTick}
              onSessionStart={handleSessionStart}
              onSessionEnd={async (sessionId) => { await endSessionV2(sessionId); }}
            />
          </motion.div>
        ) : (
          /* Quick Focus hero */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="panel-primary rounded-2xl p-5 relative overflow-hidden"
          >
            {/* Ambient blobs */}
            <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
              <div
                className="absolute rounded-full"
                style={{
                  width: 220, height: 220,
                  top: "-40%", right: "-5%",
                  background: "radial-gradient(circle, hsl(var(--primary) / 0.14), transparent 70%)",
                  filter: "blur(30px)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: 160, height: 160,
                  bottom: "-30%", left: "5%",
                  background: "radial-gradient(circle, hsl(262 78% 65% / 0.10), transparent 70%)",
                  filter: "blur(25px)",
                }}
              />
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-6 w-6 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-accent" />
                </div>
                <h2 className="text-base font-bold">Ready to lock in?</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                Start an open session right now — no planning needed. Points unlock
                after 20 minutes of real focus.
              </p>

              {/* Category chips */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {QUICK_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setQuickCategory(c.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5",
                      quickCategory === c.value
                        ? "border-primary/50 bg-primary/12 text-primary"
                        : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border",
                    )}
                  >
                    <span className="text-[13px]">{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>

              <Button
                onClick={() => startQuickFocus(quickCategory)}
                className="w-full h-11 rounded-xl text-sm font-bold glow-primary"
              >
                <Play className="w-4 h-4 mr-2 fill-current" />
                Start Focusing Now
              </Button>
            </div>
          </motion.div>
        )}

        {/* Date + Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14, duration: 0.4 }}
          className="space-y-4"
        >
          {/* Date navigator */}
          <div
            className="rounded-xl border border-border/40 overflow-hidden"
            style={{ background: "hsl(var(--surface-elevated))" }}
          >
            <div className="flex items-center gap-1 p-2">
              <div className="flex-1 min-w-0">
                <DatePickerStrip
                  selectedDate={selectedDate}
                  onSelect={setSelectedDate}
                />
              </div>
              <button
                onClick={() => setCalendarOpen((o) => !o)}
                title={calendarOpen ? "Collapse calendar" : "Open full calendar"}
                className={cn(
                  "shrink-0 h-9 w-9 rounded-lg flex items-center justify-center transition-all",
                  calendarOpen
                    ? "bg-primary/12 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent",
                )}
              >
                {calendarOpen
                  ? <ChevronDown className="w-4 h-4 rotate-180 transition-transform" />
                  : <CalendarDays className="w-4 h-4" />
                }
              </button>
            </div>

            <AnimatePresence initial={false}>
              {calendarOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  className="overflow-hidden border-t border-border/30"
                >
                  <div className="flex justify-center pt-2 pb-1">
                    <Calendar
                      mode="single"
                      selected={new Date(selectedDate + "T12:00:00")}
                      defaultMonth={new Date(selectedDate + "T12:00:00")}
                      onSelect={(date) => {
                        if (!date) return;
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, "0");
                        const d = String(date.getDate()).padStart(2, "0");
                        setSelectedDate(`${y}-${m}-${d}`);
                        setCalendarOpen(false);
                      }}
                      className="rounded-md"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tasks section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">
                {selectedDate === todayStr()
                  ? "Today"
                  : new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
              </h2>
              {dayTasks.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-16 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${dayTasks.length > 0 ? (doneCount / dayTasks.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                    {doneCount}/{dayTasks.length}
                  </span>
                </div>
              )}
            </div>

            <TaskList
              tasks={dayTasks}
              onStart={startTask}
              onComplete={completeTask}
              onFail={failTask}
              onDelete={deleteTask}
              runningTaskId={runningTask?.id || null}
            />

            <TaskForm selectedDate={selectedDate} onAdd={addTaskV2} />
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
