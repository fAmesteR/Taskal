import { useCallback, useEffect, useRef, useState } from "react";

// Pomodoro phase machine, ported from the reference's S.phase/done() logic:
// focus → short break, long break after every 4th block. Break timing derives
// from an absolute end timestamp (never a decremented counter), so throttled
// background tabs stay accurate; visibilitychange reconciles instantly.

export const SHORT_BREAK_SECONDS = 5 * 60;
export const LONG_BREAK_SECONDS = 15 * 60;

export type PomodoroPhase = "focus" | "short" | "long";

/** Which break follows the nth completed block (1-based). */
export function breakAfterBlock(blocksCompleted: number): PomodoroPhase {
  return blocksCompleted % 4 === 0 ? "long" : "short";
}

export function breakSeconds(phase: PomodoroPhase): number {
  if (phase === "long") return LONG_BREAK_SECONDS;
  if (phase === "short") return SHORT_BREAK_SECONDS;
  return 0;
}

export interface Pomodoro {
  enabled: boolean;
  phase: PomodoroPhase;
  /** Waiting for a manual start (auto-start breaks off). */
  idle: boolean;
  blocksCompleted: number;
  /** Seconds left in the running break (preset to full length while idle). */
  breakRemaining: number;
  /** Full length of the current break phase, seconds. */
  breakTotal: number;
  /** Call when a focus block's time is up — transitions into the break. */
  completeBlock: () => void;
  /** Start the idle phase (break, or the next block when autoBreak is off). */
  begin: () => void;
  /** End the break immediately and return to focus. */
  skipBreak: () => void;
}

export function usePomodoro(opts: {
  enabled: boolean;
  autoBreak: boolean;
}): Pomodoro {
  const { enabled, autoBreak } = opts;

  const [phase, setPhase] = useState<PomodoroPhase>("focus");
  const [idle, setIdle] = useState(false);
  const [blocksCompleted, setBlocksCompleted] = useState(0);
  const [breakEndAt, setBreakEndAt] = useState<number | null>(null);
  const [breakRemaining, setBreakRemaining] = useState(0);
  const blocksRef = useRef(0);

  const breakTotal = breakSeconds(phase);

  const toFocus = useCallback((idleAfter: boolean) => {
    setBreakEndAt(null);
    setBreakRemaining(0);
    setPhase("focus");
    setIdle(idleAfter);
  }, []);

  const completeBlock = useCallback(() => {
    const n = ++blocksRef.current;
    setBlocksCompleted(n);
    const br = breakAfterBlock(n);
    setPhase(br);
    setBreakRemaining(breakSeconds(br));
    if (autoBreak) {
      setIdle(false);
      setBreakEndAt(Date.now() + breakSeconds(br) * 1000);
    } else {
      setIdle(true);
      setBreakEndAt(null);
    }
  }, [autoBreak]);

  const begin = useCallback(() => {
    setIdle(false);
    if (phase !== "focus") setBreakEndAt(Date.now() + breakSeconds(phase) * 1000);
  }, [phase]);

  const skipBreak = useCallback(() => {
    if (phase !== "focus") toFocus(false);
  }, [phase, toFocus]);

  // Tick the running break. Remaining time is always recomputed from
  // breakEndAt, so a late tick (throttled tab) still lands correctly.
  useEffect(() => {
    if (!enabled || phase === "focus" || idle || breakEndAt == null) return;
    const sync = () => {
      const left = Math.max(0, Math.ceil((breakEndAt - Date.now()) / 1000));
      setBreakRemaining(left);
      if (left <= 0) toFocus(!autoBreak);
    };
    sync();
    const id = setInterval(sync, 500);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [enabled, phase, idle, breakEndAt, autoBreak, toFocus]);

  return {
    enabled,
    phase,
    idle,
    blocksCompleted,
    breakRemaining,
    breakTotal,
    completeBlock,
    begin,
    skipBreak,
  };
}
