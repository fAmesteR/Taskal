import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pause,
  Play,
  Square,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  EyeOff,
  SkipForward,
  Coffee,
} from "lucide-react";
import { toast } from "sonner";
import { Task } from "@/types/task";
import { Button } from "@/components/ui/button";
import { useFocusGuard } from "@/hooks/useFocusGuard";
import { usePomodoro } from "@/hooks/usePomodoro";
import { loadSettings } from "@/lib/settings";

interface FocusTimerProps {
  task: Task;
  onComplete: (id: string) => void;
  onFail: (id: string) => void;
  onTick: (id: string, elapsedSeconds: number) => void;
  onSessionStart?: (
    taskId: string,
    opts?: { blockMinutes?: number },
  ) => Promise<{ sessionId: string }>;
  onSessionEnd?: (sessionId: string) => Promise<void>;
}

export function FocusTimer({
  task,
  onComplete,
  onFail,
  onTick,
  onSessionStart,
  onSessionEnd,
}: FocusTimerProps) {
  const [elapsed, setElapsed] = useState(task.elapsedSeconds);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarting, setSessionStarting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const baseElapsedRef = useRef(task.elapsedSeconds);
  const resumeAtRef = useRef<number>(Date.now());
  const lastReportedRef = useRef(task.elapsedSeconds);

  // Mirror of sessionId for interval/async closures — state alone goes stale
  // inside the timer interval (it's created before the session id arrives).
  const sessionIdRef = useRef<string | null>(null);
  const setSession = (id: string | null) => {
    sessionIdRef.current = id;
    setSessionId(id);
  };

  // Pomodoro (off by default; read once per mounted timer)
  const settingsRef = useRef(loadSettings());
  const cfg = settingsRef.current;
  const blockSeconds = Math.max(60, cfg.defaultDuration * 60);
  const pom = usePomodoro({
    enabled: cfg.pomodoroEnabled,
    autoBreak: cfg.pomodoroAutoBreak,
  });
  const inBreak = pom.enabled && pom.phase !== "focus";
  // The task clock only runs during an active focus phase
  const inFocusRun = !pom.enabled || (pom.phase === "focus" && !pom.idle);
  const blockStartRef = useRef(task.elapsedSeconds);
  const boundaryFiredRef = useRef(false);

  const openEnded = !!task.openEnded;
  const totalSeconds = task.estimatedMinutes * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);

  const POINTS_UNLOCK_SECONDS = 20 * 60;
  const pointsUnlocked = elapsed >= POINTS_UNLOCK_SECONDS;
  const progress = openEnded
    ? Math.min(1, elapsed / POINTS_UNLOCK_SECONDS)
    : totalSeconds > 0
      ? Math.min(1, elapsed / totalSeconds)
      : 0;

  // During breaks/idle the guard is fully inactive — break-time tab switches
  // must not leak into the next block's integrity.
  const guard = useFocusGuard({
    sessionId,
    active: !finished && inFocusRun,
    paused,
    elapsedSeconds: elapsed,
  });
  const integrityPct = Math.round(guard.integrity * 100);
  const atRisk = integrityPct < 75;
  const integrityColor =
    atRisk ? "hsl(var(--destructive))"
    : integrityPct < 90 ? "hsl(var(--warning))"
    : "hsl(var(--success))";

  const sessionFailedRef = useRef(false);
  async function ensureSessionStarted() {
    if (!onSessionStart) return;
    if (sessionIdRef.current || sessionStarting || sessionFailedRef.current) return;

    let opts: { blockMinutes: number } | undefined;
    if (pom.enabled) {
      // A pomodoro block is its own server session, sized to the block (or the
      // task's remaining time if smaller). Below the server's 20-min floor no
      // session can earn points — run the block locally without one.
      const remainingSec = openEnded
        ? Infinity
        : Math.max(0, totalSeconds - baseElapsedRef.current);
      const sec = Math.min(blockSeconds, remainingSec);
      if (sec < 20 * 60) return;
      opts = { blockMinutes: Math.floor(sec / 60) };
    }

    setSessionStarting(true);
    try {
      const res = await onSessionStart(task.id, opts);
      setSession(res.sessionId);
    } catch {
      sessionFailedRef.current = true;
      toast.warning("Couldn't reach the server", {
        description:
          "Your timer still runs, but this session won't earn leaderboard points.",
      });
    } finally {
      setSessionStarting(false);
    }
  }

  async function finalizeSession() {
    // Read via ref: the timer interval's closure holds a stale sessionId state
    // (it fired null on every timed completion before this fix).
    const sid = sessionIdRef.current;
    if (!onSessionEnd || !sid) return;
    sessionIdRef.current = null; // guard against double-end (timer + click)
    try {
      await guard.flush();
      await onSessionEnd(sid);
    } catch { /* local UX preserved */ }
  }

  useEffect(() => {
    if (paused || finished || !inFocusRun) return;
    ensureSessionStarted();
    resumeAtRef.current = Date.now();

    const id = setInterval(() => {
      const next =
        baseElapsedRef.current +
        Math.floor((Date.now() - resumeAtRef.current) / 1000);
      if (next === lastReportedRef.current) return;
      lastReportedRef.current = next;
      setElapsed(next);
      onTick(task.id, next);

      if (!openEnded && next >= totalSeconds) {
        clearInterval(id);
        setFinished(true);
        (async () => {
          await finalizeSession();
          onComplete(task.id);
        })();
        return;
      }

      // Pomodoro block boundary (task completion above wins the tie)
      if (
        pom.enabled &&
        !boundaryFiredRef.current &&
        next - blockStartRef.current >= blockSeconds
      ) {
        boundaryFiredRef.current = true;
        clearInterval(id);
        void finalizeSession(); // ends this block's session, awards its points
        setSession(null);
        pom.completeBlock();
        toast.success("Focus block complete", {
          description: "Break time — you've earned it.",
        });
      }
    }, 500);

    return () => {
      clearInterval(id);
      baseElapsedRef.current +=
        Math.floor((Date.now() - resumeAtRef.current) / 1000);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, finished, inFocusRun, task.id, totalSeconds]);

  // New focus block: anchor its start and re-arm the boundary + session retry
  useEffect(() => {
    if (pom.enabled && pom.phase === "focus") {
      blockStartRef.current = baseElapsedRef.current;
      boundaryFiredRef.current = false;
      sessionFailedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pom.enabled, pom.phase]);

  const prevSwitchesRef = useRef(guard.switchCount);
  useEffect(() => {
    if (guard.switchCount > prevSwitchesRef.current) {
      prevSwitchesRef.current = guard.switchCount;
      setShowWarning(true);
      const t = setTimeout(() => setShowWarning(false), 5000);
      return () => clearTimeout(t);
    }
  }, [guard.switchCount]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Pomodoro display: the dial shows the current phase (block or break),
  // like the reference; non-pomodoro display is unchanged.
  const blockElapsed = Math.max(0, elapsed - blockStartRef.current);
  const blockRemaining = Math.max(0, blockSeconds - blockElapsed);
  const digitsSeconds = inBreak
    ? pom.breakRemaining
    : pom.enabled
      ? blockRemaining
      : openEnded
        ? elapsed
        : remaining;
  const displayProgress = inBreak
    ? pom.breakTotal > 0
      ? pom.breakRemaining / pom.breakTotal
      : 0
    : pom.enabled
      ? Math.min(1, blockElapsed / blockSeconds)
      : progress;
  const bricksFilled =
    pom.blocksCompleted === 0
      ? 0
      : pom.blocksCompleted % 4 === 0
        ? 4
        : pom.blocksCompleted % 4;

  const titleText = paused
    ? `⏸ Paused — Taskal`
    : inBreak
      ? `☕ ${formatTime(pom.breakRemaining)} — Break`
      : `⏱ ${formatTime(digitsSeconds)} — Focus`;
  useEffect(() => {
    document.title = titleText;
    return () => { document.title = "Taskal"; };
  }, [titleText]);

  // Ring geometry — r=95 in 210×210 viewport
  const R = 95;
  const circumference = 2 * Math.PI * R;
  const strokeDashoffset = circumference * (1 - displayProgress);
  const arcStroke = inBreak ? "hsl(var(--success))" : "url(#timerRing)";
  const isActive = !paused && !finished;

  const handleTogglePause = async () => {
    if (paused) await ensureSessionStarted();
    setPaused(!paused);
  };
  const handleCompleteClick = () => {
    setFinished(true);
    onComplete(task.id);
    void finalizeSession();
  };
  const handleFailClick = () => {
    setFinished(true);
    onFail(task.id);
    void finalizeSession();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="panel-primary rounded-2xl p-6 flex flex-col items-center relative overflow-hidden"
    >
      {/* Ambient radial behind ring */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, hsl(var(--primary) / 0.14), transparent 62%)",
        }}
      />

      {/* Label */}
      <p
        className={`relative z-10 text-[10px] font-bold uppercase tracking-[0.15em] mb-1 ${
          inBreak ? "text-success" : "text-primary"
        }`}
      >
        {pom.enabled
          ? inBreak
            ? pom.phase === "long"
              ? "Long Break"
              : "Short Break"
            : `Block ${pom.blocksCompleted + 1}`
          : openEnded
            ? "Quick Focus"
            : "Focus Mode"}
      </p>
      <p className="relative z-10 text-sm font-semibold text-foreground/80 mb-5 truncate max-w-[260px]">
        {task.title}
      </p>

      {/* Distraction warning */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="relative z-10 mb-3 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <EyeOff className="w-3.5 h-3.5 shrink-0" />
            Distraction detected — integrity dropped!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Timer ring ── */}
      <div className="relative z-10 w-60 h-60 mb-5">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 210 210">
          <defs>
            <linearGradient id="timerRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
            <linearGradient id="timerRingIntegrity" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={integrityColor} />
              <stop offset="100%" stopColor={integrityColor} stopOpacity="0.6" />
            </linearGradient>
          </defs>

          {/* Outer track */}
          <circle
            cx="105" cy="105" r={R}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="4"
            opacity="0.5"
          />

          {/* Ambient bloom (wide, blurred, very low opacity) */}
          <circle
            cx="105" cy="105" r={R}
            fill="none"
            stroke={arcStroke}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{
              filter: "blur(10px)",
              opacity: isActive ? 0.28 : 0.14,
              transition: "stroke-dashoffset 1s linear, opacity 0.4s ease",
            }}
          />

          {/* Main progress arc */}
          <circle
            cx="105" cy="105" r={R}
            fill="none"
            stroke={arcStroke}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-1000 ease-linear ${
              openEnded && pointsUnlocked && isActive ? "animate-pulse-glow" : ""
            }`}
            style={{ filter: "drop-shadow(0 0 7px hsl(var(--primary) / 0.55))" }}
          />

          {/* Tip dot — follows the progress arc end */}
          {!inBreak && displayProgress > 0.02 && (
            <circle
              cx="105" cy={105 - R}
              r="5"
              fill="hsl(var(--primary))"
              style={{
                filter: "drop-shadow(0 0 5px hsl(var(--primary) / 0.8))",
                transformOrigin: "105px 105px",
                transform: `rotate(${displayProgress * 360}deg)`,
                transition: "transform 1s linear",
              }}
            />
          )}
        </svg>

        {/* Center display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span
            className={`font-mono text-[2.4rem] font-bold tabular-nums leading-none glow-text-primary ${
              isActive ? "animate-timer-tick" : ""
            }`}
          >
            {formatTime(digitsSeconds)}
          </span>
          <span className="text-[11px] text-muted-foreground font-medium">
            {pom.enabled
              ? inBreak
                ? pom.idle
                  ? "break ready"
                  : "recharging — switches aren't tracked"
                : openEnded
                  ? `${formatTime(elapsed)} total focus`
                  : `${Math.round(progress * 100)}% of task`
              : openEnded
                ? pointsUnlocked
                  ? "✦ points unlocked"
                  : `points at 20:00`
                : `${Math.round(progress * 100)}% complete`}
          </span>
          {paused && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mt-0.5">
              paused
            </span>
          )}
        </div>
      </div>

      {/* ── Pomodoro bricks: cycle position, long break after 4 ── */}
      {pom.enabled && (
        <div
          className="relative z-10 flex items-center gap-1.5 mb-4"
          role="img"
          aria-label={`${pom.blocksCompleted} focus blocks completed this cycle`}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 w-7 rounded-full transition-colors ${
                i < bricksFilled ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Integrity bar ── */}
      <div className="relative z-10 w-full max-w-[260px] mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {atRisk
              ? <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
              : <ShieldCheck className="w-3.5 h-3.5" style={{ color: integrityColor }} />
            }
            <span className="text-xs font-semibold" style={{ color: integrityColor }}>
              {integrityPct}% integrity
            </span>
          </div>
          {guard.switchCount > 0 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {guard.switchCount} switch{guard.switchCount !== 1 ? "es" : ""} · {guard.blockedSeconds}s away
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            animate={{ width: `${integrityPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: integrityColor, boxShadow: `0 0 8px ${integrityColor}60` }}
          />
        </div>
        {atRisk && (
          <p className="text-[10px] text-destructive mt-1">
            Below 75% the session is invalidated — no points awarded.
          </p>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="relative z-10 flex items-center gap-3">
        {pom.enabled && pom.idle ? (
          <button
            onClick={pom.begin}
            title={inBreak ? "Start break" : "Start next block"}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="h-12 w-12 rounded-full border border-primary/50 bg-primary/10 flex items-center justify-center transition-all group-hover:bg-primary/20 group-active:scale-95">
              {inBreak
                ? <Coffee className="w-5 h-5 text-success" />
                : <Play className="w-5 h-5 text-primary fill-primary" />
              }
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              {inBreak ? "Break" : "Start"}
            </span>
          </button>
        ) : inBreak ? (
          <button
            onClick={pom.skipBreak}
            title="Skip break"
            className="flex flex-col items-center gap-1 group"
          >
            <div className="h-12 w-12 rounded-full border border-border/70 bg-secondary/60 flex items-center justify-center transition-all group-hover:border-foreground/30 group-hover:bg-secondary group-active:scale-95">
              <SkipForward className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              Skip
            </span>
          </button>
        ) : (
          <button
            onClick={handleTogglePause}
            disabled={sessionStarting}
            title={paused ? "Resume" : "Pause"}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="h-12 w-12 rounded-full border border-border/70 bg-secondary/60 flex items-center justify-center transition-all group-hover:border-foreground/30 group-hover:bg-secondary group-active:scale-95">
              {paused
                ? <Play className="w-5 h-5 text-primary fill-primary" />
                : <Pause className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
              }
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
              {paused ? "Resume" : "Pause"}
            </span>
          </button>
        )}

        <button
          onClick={handleCompleteClick}
          title="Complete session"
          className="flex flex-col items-center gap-1 group"
        >
          <div className="h-14 w-14 rounded-full border border-success/50 bg-success/10 flex items-center justify-center transition-all group-hover:bg-success/20 group-hover:border-success/70 group-hover:glow-success group-active:scale-95">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <span className="text-[9px] text-success uppercase tracking-wider font-bold">
            Done
          </span>
        </button>

        <button
          onClick={handleFailClick}
          title="Give up"
          className="flex flex-col items-center gap-1 group"
        >
          <div className="h-12 w-12 rounded-full border border-destructive/40 bg-destructive/8 flex items-center justify-center transition-all group-hover:bg-destructive/15 group-hover:border-destructive/60 group-active:scale-95">
            <Square className="w-4.5 h-4.5 text-destructive" />
          </div>
          <span className="text-[9px] text-destructive/70 uppercase tracking-wider font-medium">
            Stop
          </span>
        </button>
      </div>

      <p className="relative z-10 text-[10px] text-muted-foreground mt-4 text-center max-w-[260px]">
        {inBreak
          ? pom.idle
            ? "Break ready — start it when you need it"
            : "On a break · tab switches aren't tracked · focus resumes after"
          : paused
            ? "Paused · pause time reduces your integrity score"
            : "Leaving this tab is tracked · stay focused · the leaderboard is watching"}
      </p>
    </motion.div>
  );
}
