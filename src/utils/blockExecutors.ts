import type {
  WaitBlock,
  WaitUntilBlock,
  PlaySoundBlock,
  PlaySoundUntilBlock,
  NotifyBlock,
  NotifyUntilBlock,
  LoopBlock,
  Block
} from "../types";
import { msUntilTime, sleep, unitToMs } from "./time";

export interface RunnerContext {
  abort: () => boolean;
  isPaused: () => boolean;
  waitWhilePaused: () => Promise<void>;
  updateState: (activeBlockId: string | null, remainingMs?: number | null) => void;
  playSoundOnce: (url: string) => Promise<void>;
  stopAudio: () => void;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  
  return Notification.permission;
}

export function showNotification(title: string, body?: string): void {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  
  try {
    new Notification(title || "Timer", body ? { body } : undefined);
  } catch {}
}

export async function runWait(
  block: WaitBlock,
  ctx: RunnerContext
): Promise<void> {
  let remaining = unitToMs(Math.max(0, block.amount || 0), block.unit);
  if (remaining <= 0) return;

  let last = Date.now();
  while (!ctx.abort()) {
    if (ctx.isPaused()) {
      await ctx.waitWhilePaused();
      last = Date.now();
      continue;
    }

    const now = Date.now();
    remaining -= now - last;
    last = now;

    if (remaining <= 0) break;

    ctx.updateState(block.id, remaining);
    const sleepFor = Math.min(250, remaining);
    await sleep(sleepFor);
  }
  ctx.updateState(block.id, null);
}

export async function runWaitUntil(
  block: WaitUntilBlock,
  ctx: RunnerContext
): Promise<void> {
  let remaining = msUntilTime(block.time || "07:00", block.ampm);
  if (remaining <= 0) return;

  let last = Date.now();
  while (!ctx.abort()) {
    if (ctx.isPaused()) {
      await ctx.waitWhilePaused();
      last = Date.now();
      continue;
    }

    const now = Date.now();
    remaining -= now - last;
    last = now;

    if (remaining <= 0) break;

    ctx.updateState(block.id, remaining);
    const sleepFor = Math.min(250, remaining);
    await sleep(sleepFor);
  }
  ctx.updateState(block.id, null);
}

export async function runPlaySound(
  block: PlaySoundBlock | PlaySoundUntilBlock,
  ctx: RunnerContext
): Promise<void> {
  if (ctx.isPaused()) {
    await ctx.waitWhilePaused();
    if (ctx.abort()) return;
  }

  const type = block.soundType === "custom" ? "url" : block.soundType ?? "default";
  const defaultUrl = "/sounds/alarm.mp3";
  const url = type === "default" ? defaultUrl : block.customUrl || defaultUrl;
  
  await ctx.playSoundOnce(url);
  if (ctx.abort()) return;

  if (ctx.isPaused()) {
    await ctx.waitWhilePaused();
  }
}

export async function runNotify(
  block: NotifyBlock,
  ctx: RunnerContext
): Promise<void> {
  if (ctx.isPaused()) {
    await ctx.waitWhilePaused();
    if (ctx.abort()) return;
  }

  const permission = await requestNotificationPermission();
  
  if (permission === "granted") {
    const title = (block.title || "Timer").slice(0, 100);
    const body = block.body?.slice(0, 200);
    showNotification(title, body);
  }
}

export async function runNotifyUntil(
  block: NotifyUntilBlock,
  ctx: RunnerContext
): Promise<void> {
  let remainingTimeout = block.timeoutMs ?? 10000;
  const intervalMs = Math.max(100, Math.round((block.interval ?? 0.5) * 1000));
  const soundBlock: PlaySoundUntilBlock = {
    id: `${block.id}-sound`,
    type: "playSoundUntil",
    soundType: block.soundType ?? "default",
    customUrl: block.customUrl,
    label: block.label || block.title || "Beep"
  };

  let last = Date.now();

  const maybeSendNotification = async () => {
    const permission = await requestNotificationPermission();
    
    if (permission === "granted") {
      const title = (block.title || "Timer").slice(0, 100);
      const body = block.body?.slice(0, 200);
      try {
        const notify = new Notification(title || "Timer", body ? { body } : undefined);
        notify.onclick = () => ctx.stopAudio();
        notify.onclose = () => ctx.stopAudio();
      } catch {}
    }
  };

  ctx.updateState(block.id, remainingTimeout);
  await maybeSendNotification();

  while (!ctx.abort() && remainingTimeout > 0) {
    if (ctx.isPaused()) {
      await ctx.waitWhilePaused();
      last = Date.now();
      continue;
    }

    await runPlaySound(soundBlock, ctx);
    if (ctx.abort()) break;

    const afterSound = Date.now();
    remainingTimeout -= afterSound - last;
    last = afterSound;
    if (remainingTimeout <= 0) break;

    ctx.updateState(block.id, Math.max(0, remainingTimeout));

    let intervalRemaining = intervalMs;
    while (!ctx.abort() && remainingTimeout > 0 && intervalRemaining > 0) {
      if (ctx.isPaused()) {
        await ctx.waitWhilePaused();
        last = Date.now();
        continue;
      }

      const sleepFor = Math.min(250, intervalRemaining, remainingTimeout);
      await sleep(sleepFor);

      const now = Date.now();
      const delta = now - last;
      remainingTimeout -= delta;
      intervalRemaining -= delta;
      last = now;

      ctx.updateState(block.id, Math.max(0, remainingTimeout));
    }
  }

  ctx.updateState(block.id, null);
  ctx.stopAudio();
}

export async function runLoop(
  block: LoopBlock,
  ctx: RunnerContext,
  runBlocks: (blocks: Block[]) => Promise<void>
): Promise<void> {
  const repeat = block.repeat === -1 ? Infinity : Math.max(1, block.repeat || 1);
  for (let i = 0; i < repeat; i++) {
    if (ctx.abort()) return;
    await runBlocks(block.children);
  }
}
