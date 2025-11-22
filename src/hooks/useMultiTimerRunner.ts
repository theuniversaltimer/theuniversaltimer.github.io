import { useCallback, useRef, useState } from "react";
import type {
  Timer,
  Block,
  LoopBlock,
  PlaySoundBlock,
  WaitBlock,
  WaitUntilBlock,
  NotifyBlock
} from "../types";
import { msUntilTime, sleep, unitToMs } from "../utils/time";

interface RunnerState {
  isRunning: boolean;
  activeBlockId: string | null;
}

export function useMultiTimerRunner() {
  const [runningMap, setRunningMap] = useState<Record<string, RunnerState>>({});
  const abortRefs = useRef<Record<string, { abort: boolean; audio: HTMLAudioElement | null }>>({});

  const stop = useCallback((timerId: string) => {
    const ref = abortRefs.current[timerId];
    if (ref) {
      ref.abort = true;
      if (ref.audio) {
        ref.audio.pause();
        ref.audio.currentTime = 0;
      }
    }
    setRunningMap((prev) => ({
      ...prev,
      [timerId]: { isRunning: false, activeBlockId: null }
    }));
  }, []);

  const stopAll = useCallback(() => {
    Object.keys(abortRefs.current).forEach(stop);
  }, [stop]);

  const start = useCallback(
    async (timer: Timer) => {
      if (!timer.blocks.length) return;

      // stop existing runner for this timer
      stop(timer.id);

      abortRefs.current[timer.id] = { abort: false, audio: null };
      setRunningMap((prev) => ({
        ...prev,
        [timer.id]: { isRunning: true, activeBlockId: null }
      }));

      const updateState = (activeBlockId: string | null) => {
        setRunningMap((prev) => ({
          ...prev,
          [timer.id]: { isRunning: !(abortRefs.current[timer.id]?.abort ?? false), activeBlockId }
        }));
      };

      const runBlocks = async (blocks: Block[]): Promise<void> => {
        for (const block of blocks) {
          if (abortRefs.current[timer.id]?.abort) return;

          updateState(block.id);

          if (block.type === "wait") {
            const b = block as WaitBlock;
            const ms = unitToMs(Math.max(0, b.amount || 0), b.unit);
            if (ms > 0) {
              await sleep(ms);
            }
          } else if (block.type === "waitUntil") {
            const b = block as WaitUntilBlock;
            const ms = msUntilTime(b.time || "07:00", b.ampm);
            if (ms > 0) {
              await sleep(ms);
            }
          } else if (block.type === "playSound") {
            const b = block as PlaySoundBlock;
            const type =
              b.soundType === "custom" ? "url" : b.soundType ?? "default";
            const defaultUrl = "/sounds/alarm.mp3";
            const url =
              type === "default" ? defaultUrl : b.customUrl || defaultUrl;

            const audio = new Audio(url);
            audio.volume = 0.8;
            abortRefs.current[timer.id].audio = audio;

            await new Promise<void>((resolve) => {
              const cleanup = () => {
                audio.removeEventListener("ended", onEnded);
                audio.removeEventListener("error", onEnded);
              };
              const onEnded = () => {
                cleanup();
                resolve();
              };
              audio.addEventListener("ended", onEnded);
              audio.addEventListener("error", onEnded);
              audio.play().catch(onEnded);
            });
          } else if (block.type === "notify") {
            const b = block as NotifyBlock;
            const supported = typeof Notification !== "undefined";
            let done = false;
            const waitPromise = new Promise<void>((resolve) => {
              let timerId: number | undefined;
              const finish = () => {
                if (done) return;
                done = true;
                if (timerId) clearTimeout(timerId);
                resolve();
              };
              timerId = window.setTimeout(finish, 10000);

              if (supported) {
                let permission = Notification.permission;
                const showNotify = () => {
                  const title = (b.title || "Timer").slice(0, 100);
                  const body = b.body?.slice(0, 200);
                  try {
                    const notify = new Notification(title || "Timer", body ? { body } : undefined);
                    notify.onclick = finish;
                    notify.onclose = finish;
                  } catch {
                    // ignore notification failures
                  }
                };

                if (permission === "default") {
                  Notification.requestPermission()
                    .then((perm) => {
                      permission = perm;
                      if (perm === "granted") showNotify();
                    })
                    .catch(() => {
                      /* ignore */
                    });
                } else if (permission === "granted") {
                  showNotify();
                }
              }
            });

            const children = b.children || [];
            if (children.length > 0) {
              while (!done && !(abortRefs.current[timer.id]?.abort)) {
                await runBlocks(children);
                if (done || abortRefs.current[timer.id]?.abort) break;
                // avoid tight loop if children are instantaneous
                await Promise.resolve();
              }
              await waitPromise;
            } else {
              await waitPromise;
            }
          } else if (block.type === "loop") {
            const loop = block as LoopBlock;
            const repeat = loop.repeat === -1 ? Infinity : Math.max(1, loop.repeat || 1);
            for (let i = 0; i < repeat; i++) {
              if (abortRefs.current[timer.id]?.abort) return;
              await runBlocks(loop.children);
            }
          }
        }
      };

      try {
        await runBlocks(timer.blocks);
      } finally {
        updateState(null);
        setRunningMap((prev) => ({
          ...prev,
          [timer.id]: { isRunning: false, activeBlockId: null }
        }));
      }
    },
    [stop]
  );

  const isRunning = useCallback(
    (timerId: string | null | undefined) =>
      timerId ? runningMap[timerId]?.isRunning ?? false : false,
    [runningMap]
  );

  const getActiveBlockId = useCallback(
    (timerId: string | null | undefined) =>
      timerId ? runningMap[timerId]?.activeBlockId ?? null : null,
    [runningMap]
  );

  return {
    isRunning,
    getActiveBlockId,
    start,
    stop,
    stopAll
  };
}
