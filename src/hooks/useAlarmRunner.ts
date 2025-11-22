import { useCallback, useRef, useState } from "react";
import type { Alarm, Block, LoopBlock, PlaySoundBlock, WaitBlock, WaitUntilBlock } from "../types";
import { msUntilTime, sleep, unitToMs } from "../utils/time";

interface UseAlarmRunnerOptions {
  onStepChange?: (blockId: string | null) => void;
}

export function useAlarmRunner(options?: UseAlarmRunnerOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const abortRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    abortRef.current = true;
    setIsRunning(false);
    setActiveBlockId(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const runBlocks = useCallback(
    async (blocks: Block[]): Promise<void> => {
      for (const block of blocks) {
        if (abortRef.current) return;

        setActiveBlockId(block.id);
        options?.onStepChange?.(block.id);

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
          const url = type === "default" ? defaultUrl : b.customUrl || defaultUrl;

          audioRef.current = new Audio(url);
          audioRef.current.volume = 0.8;

          await new Promise<void>((resolve) => {
            if (!audioRef.current) return resolve();
            const audio = audioRef.current;

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
        } else if (block.type === "loop") {
          const loop = block as LoopBlock;
          if (loop.repeat === -1) {
            while (!abortRef.current) {
              await runBlocks(loop.children);
            }
          } else {
            const repeat = Math.max(1, loop.repeat || 1);
            for (let i = 0; i < repeat; i++) {
              if (abortRef.current) return;
              await runBlocks(loop.children);
            }
          }
        }
      }
    },
    [options]
  );

  const start = useCallback(
    async (alarm: Alarm) => {
      if (!alarm.blocks.length) return;
      stop();
      abortRef.current = false;
      setIsRunning(true);

      try {
        await runBlocks(alarm.blocks);
      } finally {
        if (!abortRef.current) {
          setActiveBlockId(null);
          options?.onStepChange?.(null);
          setIsRunning(false);
        }
      }
    },
    [runBlocks, stop, options]
  );

  return {
    isRunning,
    activeBlockId,
    start,
    stop
  };
}
