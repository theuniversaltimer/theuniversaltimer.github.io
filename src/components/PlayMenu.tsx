import React from "react";
import { Howl } from "howler";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { format as formatDate } from "date-fns";
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
import { unitToMs, msUntilTime } from "../utils/time";
import { getBlockConfig } from "../utils/blockConfig";

const getInitialRemainingMs = (blocks: Block[]): number | null => {
  if (blocks.length === 0) return null;
  const firstBlock = blocks[0];
  
  if (firstBlock.type === "wait") {
    const wait = firstBlock as WaitBlock;
    return unitToMs(wait.amount || 0, wait.unit);
  }
  
  if (firstBlock.type === "waitUntil") {
    const waitUntil = firstBlock as WaitUntilBlock;
    return msUntilTime(waitUntil.time || "07:00", waitUntil.ampm);
  }
  
  return null;
};

const formatDuration = (seconds?: number): string | null => {
  if (seconds === undefined || Number.isNaN(seconds)) return null;
  const total = Math.max(0, seconds);
  if (total >= 60) {
    const mins = Math.floor(total / 60);
    const secs = Math.round(total % 60)
      .toString()
      .padStart(2, "0");
    return `${mins}:${secs} min`;
  }
  return `${Math.round(total * 10) / 10}s`;
};

dayjs.extend(duration);

const formatCountdown = (ms: number | null): string | null => {
  if (ms === null || Number.isNaN(ms)) return null;
  const d = dayjs.duration(Math.max(0, ms));
  const hours = Math.floor(d.asHours());
  const minutes = d.minutes();
  const seconds = d.seconds();
  const mmss = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${mmss}`;
  }
  return mmss;
};

const formatElapsed = (ms?: number | null): string => {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return "00:00.00";
  const d = dayjs.duration(ms);
  const hours = Math.floor(d.asHours());
  const minutes = d.minutes();
  const seconds = d.seconds();
  const centiseconds = Math.floor(d.milliseconds() / 10);

  const base = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${base}`;
  }
  return base;
};

const formatLogTimestamp = (ms: number): string => formatDate(ms, "MM/dd/yy hh:mm:ss a");

const getSoundUrl = (block: PlaySoundBlock | PlaySoundUntilBlock): string => {
  const defaultUrl = "/sounds/alarm.mp3";
  const type = block.soundType === "custom" ? "url" : block.soundType ?? "default";
  return type === "default" ? defaultUrl : block.customUrl || defaultUrl;
};

const collectPlaySoundBlocks = (blocks: Block[]): Array<PlaySoundBlock | PlaySoundUntilBlock> => {
  const result: Array<PlaySoundBlock | PlaySoundUntilBlock> = [];
  for (const b of blocks) {
    if (b.type === "playSound") {
      result.push(b as PlaySoundBlock);
    } else if (b.type === "playSoundUntil") {
      result.push(b as PlaySoundUntilBlock);
    } else if (b.type === "loop") {
      result.push(...collectPlaySoundBlocks((b as LoopBlock).children));
    }
  }
  return result;
};

interface Props {
  timer: Timer;
  isVisible: boolean;
  onClose: () => void;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onLog?: () => void;
  isRunning: boolean;
  activeBlockId: string | null;
  remainingMs: number | null;
  elapsedMs?: number | null;
  hasStarted?: boolean;
  logs?: { elapsedMs: number; loggedAt: number }[];
}

const describeBlock = (block: Block): string => {
  const config = getBlockConfig(block.type);
  return config.getDescription(block);
};

const BlockTree: React.FC<{
  blocks: Block[];
  activeBlockId: string | null;
  collapsedMap: Record<string, boolean>;
  onToggleLoop: (id: string) => void;
  durationsMap: Record<string, number>;
  remainingMs: number | null;
  depth?: number;
}> = ({ blocks, activeBlockId, collapsedMap, onToggleLoop, durationsMap, remainingMs, depth = 0 }) => {
  return (
    <>
      {blocks.map((block) => {
        const isActive = block.id === activeBlockId;
        const isContainer = block.type === "loop";
        const isCollapsed = isContainer ? collapsedMap[block.id] ?? true : false;
        const config = getBlockConfig(block.type);
        
        const countdown = (() => {
          if (!config.supportsCountdown || !isActive || remainingMs === null) {
            return null;
          }
          
          if (block.type === "wait") {
            return formatCountdown(remainingMs);
          }
          if (block.type === "waitUntil") {
            return formatCountdown(remainingMs);
          }
          if (block.type === "notifyUntil") {
            return formatCountdown(remainingMs);
          }
          
          return null;
        })();
        
        return (
          <div key={block.id} className="mb-1 mt-1">
            <div
              className={`pastel-card flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                isActive
                  ? "bg-accent-100 text-accent-600 soft-glow"
                  : "text-accent-500"
              }`}
              style={{ marginLeft: depth * 12 }}
            >
              <span>{describeBlock(block)}</span>
              <div className="flex items-center gap-2">
                {countdown && (
                  <span className="text-accent-500 text-[11px]">
                    {countdown}
                  </span>
                )}
                {isContainer && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLoop(block.id);
                    }}
                    className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-accent-400"
                  >
                    <span className="inline-block">{isCollapsed ? "▶" : "▼"}</span>
                    <span>Container</span>
                  </button>
                )}
              </div>
            </div>
            {isContainer && !isCollapsed && (
              <BlockTree
                blocks={(block as any).children}
                activeBlockId={activeBlockId}
                collapsedMap={collapsedMap}
                onToggleLoop={onToggleLoop}
                durationsMap={durationsMap}
                remainingMs={remainingMs}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
};

const PlayMenu: React.FC<Props> = ({
  timer,
  isVisible,
  onClose,
  onPlay,
  onPause,
  onRestart,
  onLog,
  isRunning,
  activeBlockId,
  remainingMs,
  elapsedMs,
  hasStarted = false,
  logs = []
}) => {
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>({});
  const [showSteps, setShowSteps] = React.useState(false);
  const [soundDurations, setSoundDurations] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;
    const loadDurations = async () => {
      const playBlocks = collectPlaySoundBlocks(timer.blocks);
      const results = await Promise.all(
        playBlocks.map(
          (b) =>
            new Promise<{ id: string; duration?: number }>((resolve) => {
              const url = getSoundUrl(b);
              const howl = new Howl({
                src: [url],
                html5: true,
                onload: () => {
                  resolve({ id: b.id, duration: howl.duration() });
                  howl.unload();
                },
                onloaderror: () => {
                  resolve({ id: b.id, duration: undefined });
                  howl.unload();
                }
              });
            })
        )
      );
      if (cancelled) return;
      const next: Record<string, number> = {};
      results.forEach((r) => {
        if (r.duration && !Number.isNaN(r.duration)) {
          next[r.id] = r.duration;
        }
      });
      setSoundDurations(next);
    };

    loadDurations();
    return () => {
      cancelled = true;
    };
  }, [timer.blocks]);

  React.useEffect(() => {
    setShowSteps(false);
    setCollapsedMap({});
  }, [timer.id]);

  const handleToggleLoop = (id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true)
    }));
  };

  const isStopwatch = timer.mode === "simpleStopwatch";
  const supportsBlocks = !isStopwatch;
  const hasSelection = isVisible;
  const hasBlocks = supportsBlocks ? timer.blocks.length > 0 : false;
  const canPlay = isStopwatch || hasBlocks;
  const canRestart = isStopwatch || hasBlocks;
  const initialPlayLabel = isStopwatch ? "Start" : "Play";
  const primaryActionLabel = isRunning
    ? "Pause"
    : hasStarted || (isStopwatch && elapsedMs && elapsedMs > 0)
    ? "Resume"
    : initialPlayLabel;
  const primaryActionHandler = isRunning ? onPause : onPlay;
  const primaryActionDisabled = isRunning ? false : !canPlay;
  const logEntries = (timer.logs as any)?.length ? (timer as any).logs : logs;
  
  const displayRemainingMs = !isStopwatch && !hasStarted && remainingMs === null
    ? getInitialRemainingMs(timer.blocks)
    : remainingMs;
  
  const primaryTimeValue = isStopwatch
    ? formatElapsed(elapsedMs ?? 0)
    : formatCountdown(displayRemainingMs ?? 0) ?? "--:--";

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mb-4 animate-slide-down-soft">
      <div className="play-panel">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col">
            <span className="panel-label">Play Menu</span>
            <span className="panel-title">
              {hasSelection ? timer.name || "Selected Timer" : "No timer selected"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="soft-button-ghost text-xs px-3 py-1"
          >
            Close
          </button>
        </div>

        <div className="digital-bar">
          <span className="digital-time">{primaryTimeValue}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-center">
          <button
            type="button"
            onClick={primaryActionHandler}
            className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 min-w-[110px]"
            disabled={primaryActionDisabled}
          >
            {primaryActionLabel}
          </button>
          {isStopwatch ? (
            <>
              <button
                type="button"
                onClick={onLog}
                className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 min-w-[110px]"
                disabled={!onLog}
              >
                Mark
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 min-w-[110px]"
              >
                Restart
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onRestart}
              className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 min-w-[110px]"
              disabled={!canRestart}
            >
              Restart
            </button>
          )}
        </div>
        <div className="mt-1 pr-1">
          {hasSelection ? (
            isStopwatch ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  {showSteps ? (
                    <span className="text-xs text-accent-400">Logs</span>
                  ) : (
                    <span className="text-xs text-accent-400">
                      Logs are hidden. Click Show to view them.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSteps((prev) => !prev)}
                    className="text-[11px] uppercase tracking-wide text-accent-500 hover:text-accent-600"
                  >
                    {showSteps ? "Hide logs" : "Show logs"}
                  </button>
                </div>
                {showSteps ? (
                  logEntries.length ? (
                    <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                      {[...logEntries]
                        .slice()
                        .reverse()
                        .map((entry) => (
                          <div
                            key={`${entry.loggedAt}-${entry.elapsedMs}`}
                            className="pastel-card flex items-center justify-between rounded-xl px-3 py-2 text-xs text-accent-500"
                          >
                            <span className="text-[11px] tracking-wide text-accent-300">
                              {entry.name?.trim()
                                ? entry.name
                                : formatLogTimestamp(entry.loggedAt)}
                            </span>
                            <span className="font-mono text-sm text-accent-600">
                              {formatElapsed(entry.elapsedMs)}
                            </span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-accent-400">
                      No logs yet. Press Mark to log elapsed time.
                    </p>
                  )
                ) : null}
              </>
            ) : supportsBlocks ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  {showSteps ? (
                    <span className="text-xs text-accent-400">Blocks</span>
                  ) : (
                    <span className="text-xs text-accent-400">
                      Blocks are hidden. Click Show to view the sequence.
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowSteps((prev) => !prev)}
                    className="text-[11px] uppercase tracking-wide text-accent-500 hover:text-accent-600"
                  >
                    {showSteps ? "Hide blocks" : "Show blocks"}
                  </button>
                </div>
                {showSteps ? (
                  hasBlocks ? (
                    <BlockTree
                      blocks={timer.blocks}
                      activeBlockId={activeBlockId}
                      collapsedMap={collapsedMap}
                      onToggleLoop={handleToggleLoop}
                      durationsMap={soundDurations}
                      remainingMs={remainingMs}
                    />
                  ) : (
                    <p className="text-xs text-accent-400">
                      No blocks yet. Edit it to add blocks.
                    </p>
                  )
                ) : null}
              </>
            ) : null
          ) : (
            <p className="text-xs text-accent-400">No timer selected. Choose a timer to play.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayMenu;
