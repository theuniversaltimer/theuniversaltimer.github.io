import type { WaitBlock } from "../../types";

export const TIME_UNITS: Array<{ value: WaitBlock["unit"]; label: string }> = [
  { value: "seconds", label: "Seconds" },
  { value: "minutes", label: "Minutes" },
  { value: "hours", label: "Hours" },
  { value: "days", label: "Days" }
];
