import { useCallback, useEffect, useRef, useState } from "react";
import { heartbeatV2 } from "@/api/v2sessions";

// Backend rejects heartbeats less than 20s apart; 45s keeps a safe margin.
const HEARTBEAT_INTERVAL_MS = 45_000;

export interface FocusGuardState {
  /** Live estimate mirroring the backend formula: 1 - blocked% - min(0.25, pause%) */
  integrity: number;
  /** Times the user left the tab / window during this session */
  switchCount: number;
  /** Total seconds spent away from the tab */
  blockedSeconds: number;
  /** Total seconds spent paused */
  pauseSeconds: number;
  /** Flush pending integrity deltas to the backend (call before ending the session) */
  flush: () => Promise<void>;
}

/**
 * Watches for cheating signals while a focus session runs:
 * tab switches, window blur (e.g. opening social media) and pause time.
 * Periodically reports deltas to the heartbeatV2 cloud function so the
 * server can compute a tamper-proof integrity score.
 */
export function useFocusGuard(opts: {
  sessionId: string | null;
  active: boolean;
  paused: boolean;
  elapsedSeconds: number;
}): FocusGuardState {
  const { sessionId, active, paused, elapsedSeconds } = opts;

  const awaySinceRef = useRef<number | null>(null);
  const pausedSinceRef = useRef<number | null>(null);

  // Totals for the live UI estimate
  const blockedTotalRef = useRef(0);
  const pauseTotalRef = useRef(0);

  // Unsent deltas for the next heartbeat
  const blockedDeltaRef = useRef(0);
  const pauseDeltaRef = useRef(0);
  const switchDeltaRef = useRef(0);

  const [switchCount, setSwitchCount] = useState(0);
  const [blockedSeconds, setBlockedSeconds] = useState(0);
  const [pauseSeconds, setPauseSeconds] = useState(0);

  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const activeRef = useRef(active);
  activeRef.current = active;

  // --- Track tab visibility / window focus ---
  useEffect(() => {
    if (!active) return;

    const goAway = () => {
      if (!activeRef.current || pausedRef.current) return;
      if (awaySinceRef.current === null) awaySinceRef.current = Date.now();
    };

    const comeBack = () => {
      if (awaySinceRef.current === null) return;
      const secs = Math.round((Date.now() - awaySinceRef.current) / 1000);
      awaySinceRef.current = null;
      if (secs > 0) {
        blockedTotalRef.current += secs;
        blockedDeltaRef.current += secs;
        setBlockedSeconds(blockedTotalRef.current);
      }
      switchDeltaRef.current += 1;
      setSwitchCount((c) => c + 1);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") goAway();
      else comeBack();
    };

    window.addEventListener("blur", goAway);
    window.addEventListener("focus", comeBack);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("blur", goAway);
      window.removeEventListener("focus", comeBack);
      document.removeEventListener("visibilitychange", onVisibility);
      // Close any open away interval when the timer unmounts
      comeBack();
    };
  }, [active]);

  // --- Track pause time ---
  useEffect(() => {
    if (!active) return;
    if (paused) {
      pausedSinceRef.current = Date.now();
    } else if (pausedSinceRef.current !== null) {
      const secs = Math.round((Date.now() - pausedSinceRef.current) / 1000);
      pausedSinceRef.current = null;
      if (secs > 0) {
        pauseTotalRef.current += secs;
        pauseDeltaRef.current += secs;
        setPauseSeconds(pauseTotalRef.current);
      }
    }
  }, [paused, active]);

  const flush = useCallback(async () => {
    if (!sessionId) return;

    // Fold any still-open away/pause interval into the deltas,
    // restarting the interval so time keeps accruing afterwards.
    const now = Date.now();
    if (awaySinceRef.current !== null) {
      const secs = Math.round((now - awaySinceRef.current) / 1000);
      if (secs > 0) {
        awaySinceRef.current = now;
        blockedTotalRef.current += secs;
        blockedDeltaRef.current += secs;
        setBlockedSeconds(blockedTotalRef.current);
      }
    }
    if (pausedSinceRef.current !== null) {
      const secs = Math.round((now - pausedSinceRef.current) / 1000);
      if (secs > 0) {
        pausedSinceRef.current = now;
        pauseTotalRef.current += secs;
        pauseDeltaRef.current += secs;
        setPauseSeconds(pauseTotalRef.current);
      }
    }

    const blocked = blockedDeltaRef.current;
    const pause = pauseDeltaRef.current;
    const switches = switchDeltaRef.current;
    if (blocked === 0 && pause === 0 && switches === 0) return;

    // Optimistically reset; restore on failure so nothing is lost.
    blockedDeltaRef.current = 0;
    pauseDeltaRef.current = 0;
    switchDeltaRef.current = 0;
    try {
      await heartbeatV2({
        sessionId,
        blockedAppSecondsDelta: blocked,
        pauseSecondsDelta: pause,
        switchCountDelta: switches,
      });
    } catch {
      blockedDeltaRef.current += blocked;
      pauseDeltaRef.current += pause;
      switchDeltaRef.current += switches;
    }
  }, [sessionId]);

  // --- Periodic heartbeat while the session is live ---
  useEffect(() => {
    if (!active || !sessionId) return;
    const id = setInterval(() => void flush(), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, sessionId, flush]);

  // Live integrity estimate (the backend recomputes this authoritatively)
  const liveBlocked =
    blockedSeconds +
    (awaySinceRef.current !== null
      ? Math.round((Date.now() - awaySinceRef.current) / 1000)
      : 0);
  const livePause =
    pauseSeconds +
    (pausedSinceRef.current !== null
      ? Math.round((Date.now() - pausedSinceRef.current) / 1000)
      : 0);
  const d = Math.max(1, elapsedSeconds);
  const integrity = Math.max(
    0,
    Math.min(1, 1 - liveBlocked / d - Math.min(0.25, livePause / d)),
  );

  return {
    integrity,
    switchCount,
    blockedSeconds: liveBlocked,
    pauseSeconds: livePause,
    flush,
  };
}
