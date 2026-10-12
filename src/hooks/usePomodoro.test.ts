import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePomodoro,
  breakAfterBlock,
  SHORT_BREAK_SECONDS,
} from "./usePomodoro";

describe("breakAfterBlock", () => {
  it("gives a long break after every 4th block", () => {
    expect(breakAfterBlock(1)).toBe("short");
    expect(breakAfterBlock(2)).toBe("short");
    expect(breakAfterBlock(3)).toBe("short");
    expect(breakAfterBlock(4)).toBe("long");
    expect(breakAfterBlock(5)).toBe("short");
    expect(breakAfterBlock(8)).toBe("long");
  });
});

describe("usePomodoro", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("cycles focus → short break → focus automatically", () => {
    const { result } = renderHook(() =>
      usePomodoro({ enabled: true, autoBreak: true }),
    );
    expect(result.current.phase).toBe("focus");

    act(() => result.current.completeBlock());
    expect(result.current.phase).toBe("short");
    expect(result.current.blocksCompleted).toBe(1);
    expect(result.current.idle).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SHORT_BREAK_SECONDS * 1000 + 600);
    });
    expect(result.current.phase).toBe("focus");
    expect(result.current.idle).toBe(false);
  });

  it("waits for manual starts when autoBreak is off", () => {
    const { result } = renderHook(() =>
      usePomodoro({ enabled: true, autoBreak: false }),
    );
    act(() => result.current.completeBlock());
    expect(result.current.phase).toBe("short");
    expect(result.current.idle).toBe(true);

    // Break must not run while idle
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });
    expect(result.current.phase).toBe("short");

    act(() => result.current.begin());
    expect(result.current.idle).toBe(false);
    act(() => {
      vi.advanceTimersByTime(SHORT_BREAK_SECONDS * 1000 + 600);
    });
    expect(result.current.phase).toBe("focus");
    expect(result.current.idle).toBe(true); // next block also waits
  });

  it("skipBreak returns to focus immediately and running", () => {
    const { result } = renderHook(() =>
      usePomodoro({ enabled: true, autoBreak: false }),
    );
    act(() => result.current.completeBlock());
    act(() => result.current.skipBreak());
    expect(result.current.phase).toBe("focus");
    expect(result.current.idle).toBe(false);
  });
});
