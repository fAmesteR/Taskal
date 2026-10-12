import { motion, AnimatePresence } from "framer-motion";
import { Play, Check, X, Trash2, Clock, BookOpen, Brain, Dumbbell, File, Zap } from "lucide-react";
import { Task, TaskCategory } from "@/types/task";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: Task[];
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onFail: (id: string) => void;
  onDelete: (id: string) => void;
  runningTaskId: string | null;
}

const CATEGORY_META: Record<TaskCategory, { icon: React.ComponentType<{ className?: string }>; color: string; label: string }> = {
  Study:     { icon: BookOpen,   color: "hsl(var(--primary))",     label: "Study" },
  DeepWork:  { icon: Brain,      color: "hsl(262 78% 65%)",         label: "Deep Work" },
  Workout:   { icon: Dumbbell,   color: "hsl(var(--streak))",       label: "Workout" },
  Reading:   { icon: BookOpen,   color: "hsl(var(--success))",      label: "Reading" },
  Admin:     { icon: File,       color: "hsl(var(--muted-foreground))", label: "Admin" },
};

const STATUS_META: Record<string, { label: string; classes: string }> = {
  planned: { label: "Planned", classes: "bg-secondary text-muted-foreground border-border/50" },
  running: { label: "In Focus", classes: "bg-primary/15 text-primary border-primary/30" },
  done:    { label: "Done",     classes: "bg-success/12 text-success border-success/25" },
  failed:  { label: "Failed",   classes: "bg-destructive/12 text-destructive border-destructive/25" },
};

const START_GRACE_MINUTES = 5;

function canStartNow(task: Task) {
  if (!task.startTime) return { ok: true as const, reason: "" };
  if (!task.date)      return { ok: true as const, reason: "" };

  const parts = task.startTime.split(":").map(Number);
  if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return { ok: true as const, reason: "" };
  }

  const [h, m] = parts;
  const start = new Date(`${task.date}T00:00:00`);
  start.setHours(h, m, 0, 0);

  const now = new Date();
  const allowedFrom = new Date(start.getTime() - START_GRACE_MINUTES * 60 * 1000);

  if (now.getTime() >= allowedFrom.getTime()) return { ok: true as const, reason: "" };

  const hh = String(allowedFrom.getHours()).padStart(2, "0");
  const mm = String(allowedFrom.getMinutes()).padStart(2, "0");
  return {
    ok: false as const,
    reason: `Available at ${hh}:${mm} (≤${START_GRACE_MINUTES} min early)`,
  };
}

function categoryBorderColor(cat?: TaskCategory): string {
  if (!cat) return "hsl(var(--border))";
  return CATEGORY_META[cat]?.color ?? "hsl(var(--border))";
}

export function TaskList({
  tasks,
  onStart,
  onComplete,
  onFail,
  onDelete,
  runningTaskId,
}: TaskListProps) {
  if (tasks.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-14 text-muted-foreground"
      >
        <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-secondary/60 border border-border/40 flex items-center justify-center">
          <Clock className="w-5 h-5 opacity-40" />
        </div>
        <p className="text-sm font-medium">No tasks yet</p>
        <p className="text-xs mt-1 opacity-60">Add one below to get started.</p>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="popLayout">
      <div className="space-y-2">
        {tasks.map((task, i) => {
          const startGate    = canStartNow(task);
          const startDisabled = task.status === "planned" && !runningTaskId && !startGate.ok;
          const catMeta      = task.category ? CATEGORY_META[task.category] : null;
          const statusMeta   = STATUS_META[task.status];
          const isDone       = task.status === "done";
          const catColor     = categoryBorderColor(task.category);

          return (
            <motion.div
              key={task.id}
              layout
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, scale: 0.97 }}
              transition={{ delay: i * 0.04, duration: 0.28, ease: "easeOut", layout: { duration: 0.22 } }}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-3 transition-all",
                "border border-border/40 bg-surface-elevated",
                task.status === "running" && "bg-primary/5 border-primary/25",
                isDone && "opacity-60",
              )}
              style={{
                boxShadow: task.status === "running"
                  ? "inset 0 1px 0 hsl(var(--primary) / 0.30), 0 0 18px hsl(var(--primary) / 0.07)"
                  : "none",
              }}
            >
              {/* Category color stripe */}
              <div
                className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full"
                style={{ background: catColor, opacity: isDone ? 0.35 : 0.75 }}
              />

              {/* Category icon */}
              {catMeta && (
                <div
                  className="ml-1.5 shrink-0 h-8 w-8 rounded-lg flex items-center justify-center border border-border/40"
                  style={{ background: `${catColor}14` }}
                >
                  <catMeta.icon
                    className="w-4 h-4"
                    style={{ color: catColor }}
                  />
                </div>
              )}

              {/* Text content */}
              <div className="flex-1 min-w-0 ml-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <p
                    className={cn(
                      "font-medium text-sm truncate",
                      isDone ? "line-through text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {task.title}
                  </p>
                  <span
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 border",
                      statusMeta.classes,
                    )}
                  >
                    {statusMeta.label}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 mt-1 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {task.openEnded || isDone
                      ? `${Math.max(1, Math.round(task.elapsedSeconds / 60))}m focused`
                      : `${task.estimatedMinutes}min`}
                  </span>
                  {task.startTime && (
                    <span className="font-mono">
                      {task.startTime}{task.endTime ? `–${task.endTime}` : ""}
                    </span>
                  )}
                  {catMeta && !catMeta.icon && (
                    <span style={{ color: catColor }} className="font-medium">{catMeta.label}</span>
                  )}
                </div>

                {task.status === "planned" && !runningTaskId && !startGate.ok && (
                  <p className="mt-1 text-[10px] text-muted-foreground/60">{startGate.reason}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {task.status === "planned" && !runningTaskId && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 rounded-lg transition-all",
                      startDisabled
                        ? "opacity-30 cursor-not-allowed"
                        : "text-primary hover:bg-primary/12 hover:glow-primary"
                    )}
                    onClick={() => onStart(task.id)}
                    disabled={startDisabled}
                    title={startDisabled ? startGate.reason : "Start"}
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </Button>
                )}

                {task.status === "running" && (
                  <>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 rounded-lg text-success hover:bg-success/12"
                      onClick={() => onComplete(task.id)}
                    >
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/12"
                      onClick={() => onFail(task.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                )}

                {(isDone || task.status === "failed" || task.status === "planned") && (
                  <Button
                    size="icon" variant="ghost"
                    className="h-8 w-8 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={() => onDelete(task.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </AnimatePresence>
  );
}
