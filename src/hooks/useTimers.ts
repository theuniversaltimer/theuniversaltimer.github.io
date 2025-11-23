import { useLocalStorage } from "usehooks-ts";
import type { Timer, TimerMode } from "../types";
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

const deserializeTimers = (value: string): Timer[] => {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t) => t && typeof t.id === "string" && Array.isArray((t as any).blocks))
      .map((t) => withDefaultMode(t as Timer));
  } catch {
    return [];
  }
};

export function useTimers() {
  const [timers, setTimers] = useLocalStorage<Timer[]>(STORAGE_KEY, [], {
    deserializer: deserializeTimers
  });

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
