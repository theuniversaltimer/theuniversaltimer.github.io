import React from "react";
import { Howl } from "howler";
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
import { unitToMs } from "../utils/time";
import { getBlockConfig } from "../utils/blockConfig";

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

const formatCountdown = (ms: number | null): string | null => {
  if (ms === null || Number.isNaN(ms)) return null;
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mmss = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  if (h > 0) {
    return `${h.toString().padStart(2, "0")}:${mmss}`;
  }
  return mmss;
};

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
  onStop: () => void;
  isRunning: boolean;
  activeBlockId: string | null;
  remainingMs: number | null;
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
                  <span className="text-accent-500 font-mono text-[11px]">
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
  onStop,
  isRunning,
  activeBlockId,
  remainingMs
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

  const handleToggleLoop = (id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true)
    }));
  };

  const hasSelection = isVisible;
  const hasBlocks = timer.blocks.length > 0;

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mb-4 animate-slide-down-soft max-h-[70vh] overflow-y-auto">
      <div className="pastel-card pastel-hover p-4 flex flex-col gap-3 max-h-[68vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-accent-300">
              Play Menu
            </span>
            <span className="text-base font-semibold text-accent-600">
              {hasSelection ? timer.name || "Selected Timer" : "No timer selected"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <button
                type="button"
                onClick={onStop}
                className="soft-button bg-accent-200 text-accent-700 hover:bg-accent-300"
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={onPlay}
                className="soft-button-primary"
                disabled={!hasBlocks}
              >
                Play
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="soft-button-ghost text-xs px-3 py-1"
            >
              Close
            </button>
          </div>
        </div>
        <div className="mt-1 pr-1">
          {hasSelection ? (
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
                    This timer has no blocks yet. Edit it to add blocks.
                  </p>
                )
              ) : null}
            </>
          ) : (
            <p className="text-xs text-accent-400">No timer selected. Choose a timer to play.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayMenu;
