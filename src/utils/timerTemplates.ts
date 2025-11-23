import type {
  Block,
  WaitBlock,
  WaitUntilBlock,
  PlaySoundUntilBlock,
  NotifyUntilBlock,
  LoopBlock,
  Timer,
  TimerMode
} from "../types";
import { createId } from "../utils/ids";

export const makeWait = (amount: number, unit: WaitBlock["unit"]): WaitBlock => ({
  id: createId(),
  type: "wait",
  amount,
  unit
});

export const makeWaitUntil = (time: string, ampm: "AM" | "PM"): WaitUntilBlock => ({
  id: createId(),
  type: "waitUntil",
  time,
  ampm
});

export const makePlaySoundUntil = (
  label: string = "Beep",
  soundType: PlaySoundUntilBlock["soundType"] = "default",
  customUrl?: string
): PlaySoundUntilBlock => ({
  id: createId(),
  type: "playSoundUntil",
  label,
  soundType,
  customUrl
});

export const makeNotifyUntil = (
  title: string,
  body: string = "",
  timeoutMs: number = 10000,
  interval: number = 0.2
): NotifyUntilBlock => ({
  id: createId(),
  type: "notifyUntil",
  title,
  body,
   label: "Beep",
  timeoutMs,
  soundType: "default",
  interval
});

export const makeLoop = (repeat: number, children: Block[]): LoopBlock => ({
  id: createId(),
  type: "loop",
  repeat,
  children
});

export const buildTimer = (
  baseTimer: Timer,
  name: string,
  mode: TimerMode,
  blocks: Block[]
): Timer => ({
  ...baseTimer,
  name,
  mode,
  blocks
});
