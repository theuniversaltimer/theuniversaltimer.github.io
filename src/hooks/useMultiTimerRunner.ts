import { useCallback, useEffect, useRef, useState } from "react";
import useSound from "use-sound";
import type {
  Timer,
  Block,
  LoopBlock,
  PlaySoundBlock,
  PlaySoundUntilBlock,
  WaitBlock,
  WaitUntilBlock,
  NotifyBlock,
  NotifyUntilBlock
} from "../types";
import {
  runWait,
  runWaitUntil,
  runPlaySound,
  runNotify,
  runNotifyUntil,
  runLoop,
  type RunnerContext
} from "../utils/blockExecutors";

interface RunnerState {
  isRunning: boolean;
  activeBlockId: string | null;
  remainingMs: number | null;
}

export function useMultiTimerRunner() {
  const [runningMap, setRunningMap] = useState<Record<string, RunnerState>>({});
  const abortRefs = useRef<Record<string, { abort: boolean }>>({});
  const [activeSrc, setActiveSrc] = useState("/sounds/alarm.mp3");
  const resolveRef = useRef<(() => void) | null>(null);
  const [playInternal, { sound: activeSound, stop: stopInternal }] = useSound(activeSrc, {
    volume: 0.8,
    interrupt: true,
    onloaderror: () => {
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
    },
    onplayerror: () => {
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
    }
  });

  useEffect(() => {
    if (!resolveRef.current || !activeSound) return;
    const finish = () => {
      activeSound.off("end", finish);
      activeSound.off("stop", finish);
      if (resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }
    };
    activeSound.once("end", finish);
    activeSound.once("stop", finish);
    playInternal();
    return () => {
      activeSound.off("end", finish);
      activeSound.off("stop", finish);
    };
  }, [activeSound, playInternal]);

  const playSoundOnce = useCallback(
    (url: string) =>
      new Promise<void>((resolve) => {
        const targetUrl = url || "/sounds/alarm.mp3";
        resolveRef.current = resolve;
        if (targetUrl === activeSrc && activeSound) {
          const finish = () => {
            activeSound.off("end", finish);
            activeSound.off("stop", finish);
            if (resolveRef.current) {
              resolveRef.current();
              resolveRef.current = null;
            }
          };
          activeSound.once("end", finish);
          activeSound.once("stop", finish);
          playInternal();
          return;
        }
        setActiveSrc(targetUrl);
      }),
    [activeSrc, activeSound, playInternal]
  );

  const stopAudio = useCallback(() => {
    stopInternal();
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [stopInternal]);

  const stop = useCallback((timerId: string) => {
    const ref = abortRefs.current[timerId];
    if (ref) {
      ref.abort = true;
      stopAudio();
    }
    setRunningMap((prev) => ({
      ...prev,
      [timerId]: { isRunning: false, activeBlockId: null, remainingMs: null }
    }));
  }, [stopAudio]);

  const stopAll = useCallback(() => {
    Object.keys(abortRefs.current).forEach(stop);
  }, [stop]);

  const start = useCallback(
    async (timer: Timer) => {
      if (!timer.blocks.length) return;

      stop(timer.id);

      abortRefs.current[timer.id] = { abort: false };
      setRunningMap((prev) => ({
        ...prev,
        [timer.id]: { isRunning: true, activeBlockId: null, remainingMs: null }
      }));

      const updateState = (activeBlockId: string | null, remainingMs: number | null = null) => {
        setRunningMap((prev) => ({
          ...prev,
          [timer.id]: { isRunning: !(abortRefs.current[timer.id]?.abort ?? false), activeBlockId, remainingMs }
        }));
      };

      const ctx: RunnerContext = {
        abort: () => abortRefs.current[timer.id]?.abort ?? false,
        updateState,
        playSoundOnce,
        stopAudio
      };

      const runBlocks = async (blocks: Block[]): Promise<void> => {
        for (const block of blocks) {
          if (ctx.abort()) return;

          updateState(block.id);

          if (block.type === "wait") {
            await runWait(block as WaitBlock, ctx);
          } else if (block.type === "waitUntil") {
            await runWaitUntil(block as WaitUntilBlock, ctx);
          } else if (block.type === "playSound" || block.type === "playSoundUntil") {
            await runPlaySound(block as PlaySoundBlock | PlaySoundUntilBlock, ctx);
          } else if (block.type === "notify") {
            await runNotify(block as NotifyBlock, ctx);
          } else if (block.type === "notifyUntil") {
            await runNotifyUntil(block as NotifyUntilBlock, ctx);
          } else if (block.type === "loop") {
            await runLoop(block as LoopBlock, ctx, runBlocks);
          }
        }
      };

      try {
        await runBlocks(timer.blocks);
      } finally {
        updateState(null);
        setRunningMap((prev) => ({
          ...prev,
          [timer.id]: { isRunning: false, activeBlockId: null, remainingMs: null }
        }));
      }
    },
    [stop, playSoundOnce, stopAudio]
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

  const getRemainingMs = useCallback(
    (timerId: string | null | undefined) =>
      timerId ? runningMap[timerId]?.remainingMs ?? null : null,
    [runningMap]
  );

  return {
    isRunning,
    getActiveBlockId,
    getRemainingMs,
    start,
    stop,
    stopAll
  };
}
