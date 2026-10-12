import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Timer, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Task, TaskCategory, TaskDifficulty } from "@/types/task";
import { TimePicker } from "@/components/TimePicker";
import { cn } from "@/lib/utils";

type NewTaskInput = Omit<
  Task,
  "id" | "status" | "elapsedSeconds" | "createdAt" | "updatedAt"
> & {
  durationMinutes?: number;
  notes?: string;
};

interface TaskFormProps {
  selectedDate: string;
  onAdd: (task: NewTaskInput) => void | Promise<unknown>;
}

const MIN_DURATION = 20;
const MAX_DURATION = 480;
const PRESETS = [25, 45, 60, 90];

const CATEGORIES: { value: TaskCategory; label: string; emoji: string }[] = [
  { value: "Study",    label: "Study",     emoji: "📖" },
  { value: "DeepWork", label: "Deep Work", emoji: "🧠" },
  { value: "Workout",  label: "Workout",   emoji: "🏋️" },
  { value: "Reading",  label: "Reading",   emoji: "📚" },
  { value: "Admin",    label: "Admin",     emoji: "📋" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function diffMinutes(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) return null;
  let d = eh * 60 + em - (sh * 60 + sm);
  if (d <= 0) d += 24 * 60;
  return d;
}

function addMinutes(start: string, mins: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

export function TaskForm({ selectedDate, onAdd }: TaskFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<TaskCategory>("Study");
  const [difficulty, setDifficulty] = useState<TaskDifficulty>("Normal");
  const [saving, setSaving] = useState(false);

  const duration = startTime && endTime ? diffMinutes(startTime, endTime) : null;
  const durationValid = duration !== null && duration >= MIN_DURATION && duration <= MAX_DURATION;
  const canSubmit = title.trim().length > 0 && durationValid;

  const reset = () => {
    setTitle("");
    setStartTime("");
    setEndTime("");
    setCategory("Study");
    setDifficulty("Normal");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || duration === null || saving) return;
    setSaving(true);
    try {
      await onAdd({
        title: title.trim(),
        date: selectedDate,
        startTime,
        endTime,
        estimatedMinutes: duration,
        durationMinutes: duration,
        category,
        difficulty,
      });
      reset();
      setOpen(false);
    } catch {
      toast.error("Couldn't save the task", {
        description: "The server is unreachable. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AnimatePresence initial={false} mode="wait">
        {!open ? (
          <motion.div
            key="btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <button
              onClick={() => setOpen(true)}
              className={cn(
                "w-full h-11 rounded-xl flex items-center justify-center gap-2",
                "border border-dashed border-border/50 text-muted-foreground",
                "hover:border-primary/40 hover:text-primary hover:bg-primary/5",
                "transition-all duration-200 text-sm font-medium",
              )}
            >
              <Plus className="w-4 h-4" />
              Schedule a task
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onSubmit={handleSubmit}
            className="rounded-xl overflow-hidden"
            style={{
              background: "hsl(var(--surface-elevated))",
              border: "1px solid hsl(var(--border) / 0.5)",
              boxShadow: "inset 0 1px 0 hsl(171 100% 47% / 0.18), 0 4px 24px hsl(0 0% 0% / 0.3)",
            }}
          >
            {/* Form header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
              <h3 className="text-sm font-bold">New Task</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Task name */}
              <div>
                <Label htmlFor="title" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Task name
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What will you focus on?"
                  className="bg-secondary/50 border-border/60 h-10 text-sm focus:ring-1 focus:ring-primary/40"
                  autoFocus
                />
              </div>

              {/* Category */}
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Category
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold transition-all flex items-center gap-1",
                        category === c.value
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      <span>{c.emoji}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty */}
              <div>
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                  Intensity
                </Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["Normal", "DeepFocus"] as TaskDifficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                        difficulty === d
                          ? "border-accent/50 bg-accent/12 text-accent"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {d === "DeepFocus" ? "⚡ Deep Focus ×1.2" : "Normal"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time window */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Start</Label>
                  <TimePicker
                    value={startTime}
                    onChange={(v) => {
                      setStartTime(v);
                      if (endTime && startTime) {
                        const d = diffMinutes(startTime, endTime);
                        if (d) setEndTime(addMinutes(v, d));
                      }
                    }}
                    placeholder="Now"
                    minuteStep={5}
                  />
                </div>
                <div>
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">End</Label>
                  <TimePicker
                    value={endTime}
                    onChange={setEndTime}
                    placeholder="Pick end"
                    minuteStep={5}
                    disabled={!startTime}
                  />
                </div>
              </div>

              {/* Quick presets */}
              {startTime && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold mr-0.5">Quick</span>
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEndTime(addMinutes(startTime, p))}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-mono font-medium transition-all",
                        duration === p
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
                      )}
                    >
                      {p}m
                    </button>
                  ))}
                </div>
              )}

              {/* Duration readout */}
              {duration !== null && (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
                    durationValid
                      ? "border-primary/25 bg-primary/5 text-foreground"
                      : "border-destructive/35 bg-destructive/8 text-destructive",
                  )}
                >
                  {durationValid
                    ? <Timer className="w-3.5 h-3.5 text-primary shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  }
                  {durationValid ? (
                    <span>
                      <span className="font-mono font-bold">{duration} min</span>
                      {" "}session · {startTime} → {endTime}
                    </span>
                  ) : (
                    <span>Sessions must be {MIN_DURATION}–{MAX_DURATION} minutes</span>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 font-semibold text-sm"
                disabled={!canSubmit || saving}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                ) : canSubmit && duration !== null ? (
                  `Schedule ${duration} min session`
                ) : (
                  "Schedule task"
                )}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
