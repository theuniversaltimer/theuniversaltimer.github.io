import type { AmPm, TimeUnit } from "../types";
import { parse, isValid, addDays, isBefore, set, format as formatDate } from "date-fns";

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
  let target = set(now, { hours: hour, minutes: minute, seconds: 0, milliseconds: 0 });

  if (isBefore(target, now) || target.getTime() === now.getTime()) {
    target = addDays(target, 1);
  }

  return target.getTime() - now.getTime();
}

export function sanitizeTimeInput(value: string, fallback: string): string {
  const trimmed = value.trim();
  const parsed = parse(trimmed, "H:mm", new Date());
  if (!isValid(parsed)) return fallback;

  const hours24 = parsed.getHours();
  const minutes = parsed.getMinutes();

  // Clamp to 12-hour input expectations (1-12)
  const hours12 = ((hours24 + 11) % 12) + 1;

  const hh = hours12.toString();
  const mm = minutes.toString().padStart(2, "0");
  const normalized = `${hh}:${mm}`;

  // Ensure round-trip matches original hours/minutes intent
  const reParsed = parse(normalized, "H:mm", new Date());
  if (!isValid(reParsed)) return fallback;

  return normalized;
}
