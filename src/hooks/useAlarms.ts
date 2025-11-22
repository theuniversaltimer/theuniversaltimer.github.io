import { useEffect, useState } from "react";
import type { Alarm, AlarmMode, Block } from "../types";
import { createId } from "../utils/ids";

const STORAGE_KEY = "alarm-generator-alarms";

const makeUniqueName = (
  baseName: string,
  alarms: Alarm[],
  ignoreId?: string
): string => {
  const fallback = "New Timer";
  const base = baseName.trim() || fallback;
  const existing = new Set(
    alarms
      .filter((a) => a.id !== ignoreId)
      .map((a) => a.name.trim().toLowerCase())
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

const withDefaultMode = (alarm: Alarm): Alarm & { mode: AlarmMode } => ({
  ...alarm,
  mode: (alarm as any).mode ?? "stopwatch"
});

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const safeLoad = (): Alarm[] | null => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed
          .filter((a) => a && typeof a.id === "string" && Array.isArray((a as any).blocks))
          .map((a) => withDefaultMode(a as Alarm));
      } catch {
        return null;
      }
    };

    const stored = safeLoad();
    if (stored && stored.length) {
      setAlarms(stored);
    } else {
      setAlarms([]);
    }
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
    } catch {
      // ignore write failures (e.g., storage blocked)
    }
  }, [alarms, hasLoaded]);

  const createAlarm = () => {
    const created: Alarm = {
      id: createId(),
      name: makeUniqueName("New Timer", alarms),
      blocks: [],
      mode: "stopwatch"
    };
    setAlarms((prev) => [...prev, created]);
    return created;
  };

  const updateAlarm = (updated: Alarm) => {
    setAlarms((prev) =>
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

  const deleteAlarm = (id: string) => {
    setAlarms((prev) => prev.filter((a) => a.id !== id));
  };

  return { alarms, createAlarm, updateAlarm, deleteAlarm };
}
