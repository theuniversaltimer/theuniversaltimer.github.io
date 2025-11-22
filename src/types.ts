export type TimeUnit = "seconds" | "minutes" | "hours" | "days";
export type AmPm = "AM" | "PM";

export type BlockType = "loop" | "wait" | "waitUntil" | "playSound";

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

export type Block = LoopBlock | WaitBlock | WaitUntilBlock | PlaySoundBlock;

export interface Alarm {
  id: string;
  name: string;
  blocks: Block[];
  mode?: AlarmMode;
}

export type ThemeName = "pink" | "green" | "blue" | "yellow" | "purple";

export type AlarmMode = "alarm" | "stopwatch";
