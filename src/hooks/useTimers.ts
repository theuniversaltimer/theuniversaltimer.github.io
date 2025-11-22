import { useEffect, useState } from "react";
import type { Timer, TimerMode, Block } from "../types";
import { createId } from "../utils/ids";

const STORAGE_KEY = "timer-generator-timers";

const makeUniqueName = (
  baseName: string,
  timers: Timer[],
  ignoreId?: string
): string => {
  const fallback = "New Timer";
  const base = baseName.trim() || fallback;
  const existing = new Set(
    timers
      .filter((t) => t.id !== ignoreId)
      .map((t) => t.name.trim().toLowerCase())
  );

  if (!existing.has(base.toLowerCase())) return base;

  let i = 2;
  let candidate = `${base}${i}`;
  while (existing.has(candidate.toLowerCase())) {
    i += 1;
    candidate = `${base}${i}`;
  }
  return candidate;
};

const withDefaultMode = (timer: Timer): Timer & { mode: TimerMode } => ({
  ...timer,
  mode: (timer as any).mode ?? "stopwatch"
});

export function useTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const safeLoad = (): Timer[] | null => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed
          .filter((t) => t && typeof t.id === "string" && Array.isArray((t as any).blocks))
          .map((t) => withDefaultMode(t as Timer));
      } catch {
        return null;
      }
    };

    const stored = safeLoad();
    if (stored && stored.length) {
      setTimers(stored);
    } else {
      setTimers([]);
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } catch {
      // ignore write failures (e.g., storage blocked)
    }
  }, [timers, hasLoaded]);

  const createTimer = () => {
    const created: Timer = {
      id: createId(),
      name: makeUniqueName("New Timer", timers),
      blocks: [],
      mode: "stopwatch"
    };
    setTimers((prev) => [...prev, created]);
    return created;
  };

  const updateTimer = (updated: Timer) => {
    setTimers((prev) =>
      prev.map((a) =>
        a.id === updated.id
          ? {
              ...updated,
              name: makeUniqueName(updated.name, prev, updated.id)
            }
          : a
      )
    );
  };

  const deleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((a) => a.id !== id));
  };

  return { timers, createTimer, updateTimer, deleteTimer };
}
