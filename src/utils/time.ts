import type { AmPm, TimeUnit } from "../types";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function unitToMs(amount: number, unit: TimeUnit): number {
  switch (unit) {
    case "seconds":
      return amount * 1000;
    case "minutes":
      return amount * 60 * 1000;
    case "hours":
      return amount * 60 * 60 * 1000;
    case "days":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount * 1000;
  }
}

export function msUntilTime(time: string, ampm: AmPm): number {
  const [hhStr, mmStr] = time.split(":");
  let hour = parseInt(hhStr, 10);
  const minute = parseInt(mmStr || "0", 10);

  if (ampm === "PM" && hour !== 12) {
    hour += 12;
  }
  if (ampm === "AM" && hour === 12) {
    hour = 0;
  }

  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

export function sanitizeTimeInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return fallback;
  if (hours < 1 || hours > 12) return fallback;
  if (minutes < 0 || minutes > 59) return fallback;
  const hh = hours.toString();
  const mm = minutes.toString().padStart(2, "0");
  return `${hh}:${mm}`;
}
