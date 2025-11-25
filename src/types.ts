export type TimeUnit = "seconds" | "minutes" | "hours" | "days";
export type AmPm = "AM" | "PM";

export type BlockType =
  | "loop"
  | "wait"
  | "waitUntil"
  | "playSound"
  | "playSoundUntil"
  | "notify"
  | "notifyUntil";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface LoopBlock extends BaseBlock {
  type: "loop";
  repeat: number;
  children: Block[];
}

export interface WaitBlock extends BaseBlock {
  type: "wait";
  amount: number;
  unit: TimeUnit;
}

export interface WaitUntilBlock extends BaseBlock {
  type: "waitUntil";
  time: string;
  ampm: AmPm;
}

export interface PlaySoundBlock extends BaseBlock {
  type: "playSound";
  soundType: "default" | "url" | "upload" | "custom";
  label: string;
  customUrl?: string;
}

export interface PlaySoundUntilBlock extends BaseBlock {
  type: "playSoundUntil";
  soundType: "default" | "url" | "upload" | "custom";
  label: string;
  customUrl?: string;
}

export interface NotifyBlock extends BaseBlock {
  type: "notify";
  title: string;
  body?: string;
}

export interface NotifyUntilBlock extends BaseBlock {
  type: "notifyUntil";
  title: string;
  body?: string;
  label?: string;
  timeoutMs?: number;
  soundType?: "default" | "url" | "upload" | "custom";
  customUrl?: string;
  interval?: number;
  children?: Block[];
}

export type Block =
  | LoopBlock
  | WaitBlock
  | WaitUntilBlock
  | PlaySoundBlock
  | PlaySoundUntilBlock
  | NotifyBlock
  | NotifyUntilBlock;

export interface Timer {
  id: string;
  name: string;
  blocks: Block[];
  mode?: TimerMode;
  /**
   * When true, the timer is template-only (not editable in the editor).
   */
  locked?: boolean;
  logs?: StopwatchLog[];
}

export type ThemeName =
  | "pink"
  | "green"
  | "blue"
  | "yellow"
  | "purple"
  | "white"
  | "dark";

export type TimerMode = "alarm" | "stopwatch" | "simpleStopwatch";

export interface StopwatchLog {
  id: string;
  name: string;
  elapsedMs: number;
  loggedAt: number;
}
