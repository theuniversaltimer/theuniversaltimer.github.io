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
  const ms = unitToMs(Math.max(0, block.amount || 0), block.unit);
  if (ms <= 0) return;

  const endAt = Date.now() + ms;
  while (!ctx.abort()) {
    const remaining = endAt - Date.now();
    if (remaining <= 0) break;
    ctx.updateState(block.id, remaining);
    await sleep(Math.min(250, remaining));
  }
  ctx.updateState(block.id, null);
}

export async function runWaitUntil(
  block: WaitUntilBlock,
  ctx: RunnerContext
): Promise<void> {
  const ms = msUntilTime(block.time || "07:00", block.ampm);
  if (ms <= 0) return;

  const endAt = Date.now() + ms;
  while (!ctx.abort()) {
    const remaining = endAt - Date.now();
    if (remaining <= 0) break;
    ctx.updateState(block.id, remaining);
    await sleep(Math.min(250, remaining));
  }
  ctx.updateState(block.id, null);
}

export async function runPlaySound(
  block: PlaySoundBlock | PlaySoundUntilBlock,
  ctx: RunnerContext
): Promise<void> {
  const type = block.soundType === "custom" ? "url" : block.soundType ?? "default";
  const defaultUrl = "/sounds/alarm.mp3";
  const url = type === "default" ? defaultUrl : block.customUrl || defaultUrl;
  
  await ctx.playSoundOnce(url);
}

export async function runNotify(
  block: NotifyBlock,
  ctx: RunnerContext
): Promise<void> {
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
  let done = false;
  const timeoutMs = block.timeoutMs ?? 10000;
  const intervalMs = Math.max(100, Math.round((block.interval ?? 0.5) * 1000));
  const soundBlock: PlaySoundUntilBlock = {
    id: `${block.id}-sound`,
    type: "playSoundUntil",
    soundType: block.soundType ?? "default",
    customUrl: block.customUrl,
    label: block.label || block.title || "Beep"
  };

  const waitPromise = new Promise<void>((resolve) => {
    let timerId: number | undefined;
    const finish = () => {
      if (done) return;
      done = true;
      if (timerId) clearTimeout(timerId);
      ctx.stopAudio();
      resolve();
    };
    
    timerId = window.setTimeout(finish, timeoutMs);

    requestNotificationPermission().then((permission) => {
      if (permission === "granted") {
        const title = (block.title || "Timer").slice(0, 100);
        const body = block.body?.slice(0, 200);
        try {
          const notify = new Notification(title || "Timer", body ? { body } : undefined);
          notify.onclick = finish;
          notify.onclose = finish;
        } catch {}
      }
    });
  });

  (async () => {
    while (!done && !ctx.abort()) {
      // Wait for the sound to finish playing completely
      await runPlaySound(soundBlock, ctx);

      if (done || ctx.abort()) break;

      // Only start counting the interval pause after the sound is done
      await sleep(intervalMs);
    }
  })();

  await waitPromise;
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
