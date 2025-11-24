import { useEffect, useMemo, useState } from "react";
import type { Timer, TimerMode } from "../types";
import { createId } from "../utils/ids";
import { db, loadTimers, saveTimer, deleteTimerById } from "../db";
import { TimerSchema } from "../schemas/timer";
import { z } from "zod";

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

const withDefaults = (timer: Timer): Timer & { mode: TimerMode } => {
  const mode = (timer as any).mode ?? "stopwatch";
  const locked =
    mode === "simpleStopwatch"
      ? false
      : (timer as any).locked ?? false;
  return {
    ...timer,
    mode,
    locked,
    logs: Array.isArray(timer.logs) ? timer.logs : []
  };
};

export function useTimers() {
  const [timers, setTimers] = useState<Timer[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        const loaded = await loadTimers();
        if (!mounted) return;
        let safe = loaded
          .map((t) => {
            const result = TimerSchema.safeParse(t);
            if (result.success) return withDefaults(result.data);
            return null;
          })
          .filter(Boolean) as Timer[];

        // Migrate legacy localStorage timers if Dexie is empty
        if (safe.length === 0) {
          const legacy = localStorage.getItem(STORAGE_KEY);
          if (legacy) {
            try {
              const parsed = JSON.parse(legacy);
              if (Array.isArray(parsed)) {
                const migrated: Timer[] = [];
                for (const t of parsed) {
                  const res = TimerSchema.safeParse(t);
                  if (res.success) {
                    const normalized = withDefaults(res.data);
                    migrated.push(normalized);
                    await saveTimer(normalized);
                  }
                }
                if (migrated.length) {
                  safe = migrated;
                }
              }
            } catch {
              // ignore legacy parse errors
            }
          }
        }

        setTimers(safe);
        setReady(true);
      } catch {
        if (mounted) {
          setReady(true);
          setTimers([]);
        }
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const createTimer = () => {
    const created: Timer = {
      id: createId(),
      name: makeUniqueName("New Timer", timers),
      blocks: [],
      mode: "stopwatch",
      locked: false,
      logs: []
    };
    TimerSchema.parse(created);
    const next = [...timers, created];
    setTimers(next);
    saveTimer(created);
    return created;
  };

  const updateTimer = (updated: Timer) => {
    const nextName = makeUniqueName(updated.name, timers, updated.id);
    const parsed = TimerSchema.safeParse({ ...updated, name: nextName });
    const normalized = parsed.success
      ? withDefaults(parsed.data as Timer)
      : withDefaults({ ...updated, name: nextName });
    // Ensure validation throws for invalid timers on save attempt
    TimerSchema.parse(normalized);
    setTimers((prev) =>
      prev.map((a) => (a.id === normalized.id ? normalized : a))
    );
    saveTimer(normalized);
  };

  const deleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((a) => a.id !== id));
    deleteTimerById(id);
  };

  return { timers, createTimer, updateTimer, deleteTimer, ready };
}
