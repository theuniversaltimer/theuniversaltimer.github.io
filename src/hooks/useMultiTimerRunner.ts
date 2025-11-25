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

interface StopwatchState {
  elapsedMs: number;
  isRunning: boolean;
  startedAt: number | null;
}

export function useMultiTimerRunner() {
  const [runningMap, setRunningMap] = useState<Record<string, RunnerState>>({});
  const [stopwatchMap, setStopwatchMap] = useState<Record<string, StopwatchState>>({});
  const [stopwatchTick, setStopwatchTick] = useState(0);
  const controlRefs = useRef<
    Record<string, { abort: boolean; paused: boolean; resumeResolvers: Array<() => void> }>
  >({});
  const [activeSrc, setActiveSrc] = useState("/sounds/alarm.mp3");
  const resolveRef = useRef<(() => void) | null>(null);
  const [playInternal, { sound: activeSound, stop: stopInternal }] = useSound(activeSrc, {
    volume: 0.8,
    interrupt: false,
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

  useEffect(() => {
    const hasRunningStopwatch = Object.values(stopwatchMap).some((s) => s.isRunning);
    if (!hasRunningStopwatch) return;
    const id = window.setInterval(() => setStopwatchTick((t) => t + 1), 20);
    return () => clearInterval(id);
  }, [stopwatchMap]);

  const playSoundOnce = useCallback(
    (url: string) =>
      new Promise<void>((resolve) => {
        const targetUrl = url || "/sounds/alarm.mp3";

        if (targetUrl === activeSrc && activeSound) {
          // Same sound, play immediately
          resolveRef.current = resolve;
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
        } else {
          // Different sound, need to wait for useEffect to set it up
          resolveRef.current = resolve;
          setActiveSrc(targetUrl);
        }
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

  const getStopwatchElapsed = (state?: StopwatchState): number => {
    if (!state) return 0;
    if (state.isRunning && state.startedAt) {
      return state.elapsedMs + (Date.now() - state.startedAt);
    }
    return state.elapsedMs;
  };

  const startStopwatch = useCallback(
    (timer: Timer, options?: { reset?: boolean }) => {
      setStopwatchMap((prev) => {
        const current = prev[timer.id];
        const baseElapsed = options?.reset ? 0 : getStopwatchElapsed(current);
        return {
          ...prev,
          [timer.id]: {
            elapsedMs: baseElapsed,
            isRunning: true,
            startedAt: Date.now()
          }
        };
      });
    },
    []
  );

  const pauseStopwatch = useCallback((timerId: string) => {
    setStopwatchMap((prev) => {
      const current = prev[timerId];
      const elapsed = getStopwatchElapsed(current);
      return {
        ...prev,
        [timerId]: {
          elapsedMs: elapsed,
          isRunning: false,
          startedAt: null
        }
      };
    });
  }, []);

  const resetStopwatch = useCallback((timerId: string) => {
    setStopwatchMap((prev) => ({
      ...prev,
      [timerId]: { elapsedMs: 0, isRunning: false, startedAt: null }
    }));
  }, []);

  const stopAllStopwatches = useCallback(() => {
    setStopwatchMap((prev) => {
      const next: Record<string, StopwatchState> = {};
      Object.keys(prev).forEach((id) => {
        const elapsed = getStopwatchElapsed(prev[id]);
        next[id] = { elapsedMs: elapsed, isRunning: false, startedAt: null };
      });
      return next;
    });
  }, []);

  const getControl = useCallback((timerId: string) => {
    if (!controlRefs.current[timerId]) {
      controlRefs.current[timerId] = { abort: false, paused: false, resumeResolvers: [] };
    }
    return controlRefs.current[timerId];
  }, []);

  const settlePauseWaiters = useCallback((timerId: string) => {
    const control = controlRefs.current[timerId];
    if (!control) return;
    control.resumeResolvers.forEach((resolve) => resolve());
    control.resumeResolvers = [];
  }, []);

  const stopBlocks = useCallback(
    (timerId: string) => {
      const control = controlRefs.current[timerId];
      if (control) {
        control.abort = true;
        control.paused = false;
        settlePauseWaiters(timerId);
      }
      stopAudio();
      setRunningMap((prev) => ({
        ...prev,
        [timerId]: { isRunning: false, activeBlockId: null, remainingMs: null }
      }));
    },
    [settlePauseWaiters, stopAudio]
  );

  const stopAllBlocks = useCallback(() => {
    Object.keys(controlRefs.current).forEach(stopBlocks);
  }, [stopBlocks]);

  const pauseBlocks = useCallback(
    (timerId: string) => {
      const control = controlRefs.current[timerId];
      if (!control || control.abort) return;
      control.paused = true;
      stopAudio();
      setRunningMap((prev) => {
        const current = prev[timerId];
        if (!current) return prev;
        return {
          ...prev,
          [timerId]: { ...current, isRunning: false }
        };
      });
    },
    [stopAudio]
  );

  const resumeBlocks = useCallback(
    (timerId: string) => {
      const control = controlRefs.current[timerId];
      if (!control || control.abort || !control.paused) return;
      control.paused = false;
      settlePauseWaiters(timerId);
      setRunningMap((prev) => {
        const current = prev[timerId];
        if (!current) return prev;
        return {
          ...prev,
          [timerId]: { ...current, isRunning: true }
        };
      });
    },
    [settlePauseWaiters]
  );

  const startBlocks = useCallback(
    async (timer: Timer) => {
      if (!timer.blocks.length) return;

      stopBlocks(timer.id);

      const control = getControl(timer.id);
      control.abort = false;
      control.paused = false;
      settlePauseWaiters(timer.id);
      setRunningMap((prev) => ({
        ...prev,
        [timer.id]: { isRunning: true, activeBlockId: null, remainingMs: null }
      }));

      const waitWhilePaused = async () => {
        const current = getControl(timer.id);
        if (!current.paused) return;
        await new Promise<void>((resolve) => {
          current.resumeResolvers.push(resolve);
        });
      };

      const updateState = (activeBlockId: string | null, remainingMs: number | null = null) => {
        const current = getControl(timer.id);
        setRunningMap((prev) => ({
          ...prev,
          [timer.id]: {
            isRunning: !(current.abort ?? false) && !current.paused,
            activeBlockId,
            remainingMs
          }
        }));
      };

      const ctx: RunnerContext = {
        abort: () => getControl(timer.id).abort ?? false,
        isPaused: () => getControl(timer.id).paused ?? false,
        waitWhilePaused,
        updateState,
        playSoundOnce,
        stopAudio
      };

      const runBlocks = async (blocks: Block[]): Promise<void> => {
        for (const block of blocks) {
          if (ctx.abort()) return;
          if (ctx.isPaused()) {
            await ctx.waitWhilePaused();
            if (ctx.abort()) return;
          }

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
            await runNotifyUntil(block as NotifyUntilBlock, ctx, runBlocks);
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
    [getControl, settlePauseWaiters, stopBlocks, playSoundOnce, stopAudio]
  );

  const start = useCallback(
    async (timer: Timer, options?: { reset?: boolean }) => {
      if (timer.mode === "simpleStopwatch") {
        startStopwatch(timer, options);
        return;
      }
      const control = controlRefs.current[timer.id];
      if (control?.paused && !control.abort) {
        resumeBlocks(timer.id);
        return;
      }
      await startBlocks(timer);
    },
    [startStopwatch, startBlocks, resumeBlocks]
  );

  const pause = useCallback(
    (timer: Timer) => {
      if (timer.mode === "simpleStopwatch") {
        pauseStopwatch(timer.id);
        return;
      }
      pauseBlocks(timer.id);
    },
    [pauseStopwatch, pauseBlocks]
  );

  const restart = useCallback(
    async (timer: Timer) => {
      if (timer.mode === "simpleStopwatch") {
        startStopwatch(timer, { reset: true });
        return;
      }
      await startBlocks(timer);
    },
    [startStopwatch, startBlocks]
  );

  const stop = useCallback(
    (timerId: string) => {
      pauseStopwatch(timerId);
      stopBlocks(timerId);
    },
    [pauseStopwatch, stopBlocks]
  );

  const stopAll = useCallback(() => {
    stopAllBlocks();
    stopAllStopwatches();
  }, [stopAllBlocks, stopAllStopwatches]);

  const isRunning = useCallback(
    (timerId: string | null | undefined) =>
      timerId
        ? (runningMap[timerId]?.isRunning ?? false) ||
          (stopwatchMap[timerId]?.isRunning ?? false)
        : false,
    [runningMap, stopwatchMap, stopwatchTick]
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

  const getElapsedMs = useCallback(
    (timerId: string | null | undefined) => {
      if (!timerId) return 0;
      return getStopwatchElapsed(stopwatchMap[timerId]);
    },
    [stopwatchMap, stopwatchTick]
  );

  return {
    isRunning,
    getActiveBlockId,
    getRemainingMs,
    getElapsedMs,
    start,
    pause,
    restart,
    stop,
    stopAll,
    resetStopwatch
  };
}
