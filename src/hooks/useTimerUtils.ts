import { useCallback } from "react";
import type { Timer } from "../types";

export type TimerLike = any; // replace with your Timer type import if desired

export const isLikelyStopwatch = (t?: TimerLike) =>
  !t || (t.duration == null && t.nextTrigger == null && t.scheduledAt == null);

export const isPaused = (t?: TimerLike) => {
  if (!t) return false;
  if (typeof (t as any).paused === "boolean") return (t as any).paused;
  if (typeof (t as any).running === "boolean") return !(t as any).running;
  if (typeof (t as any).remaining === "number") return (t as any).remaining <= 0;
  return false;
};

export const buildRestartPayload = (t: TimerLike, now = Date.now()): TimerLike => {
  const payload: any = { ...t, paused: false, id: t.id, restart: true };
  if (t.duration != null) {
    payload.startedAt = now;
    payload.remaining = t.duration;
  } else if (t.nextTrigger != null || t.scheduledAt != null || (t as any).time != null) {
    const candidate = t.nextTrigger ?? t.scheduledAt ?? (t as any).time;
    payload.nextTrigger = Math.max(Number(candidate) || now, now);
    payload.startedAt = now;
  } else {
    payload.startedAt = now;
  }
  return payload;
};

export const useTimerUtils = () => {
  return { isLikelyStopwatch, isPaused, buildRestartPayload };
};
