import React from "react";
import type { Alarm, Block, LoopBlock, PlaySoundBlock, WaitBlock, WaitUntilBlock } from "../types";

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

const getSoundUrl = (block: PlaySoundBlock): string => {
  const defaultUrl = "/sounds/alarm.mp3";
  const type = block.soundType === "custom" ? "url" : block.soundType ?? "default";
  return type === "default" ? defaultUrl : block.customUrl || defaultUrl;
};

const collectPlaySoundBlocks = (blocks: Block[]): PlaySoundBlock[] => {
  const result: PlaySoundBlock[] = [];
  for (const b of blocks) {
    if (b.type === "playSound") {
      result.push(b as PlaySoundBlock);
    } else if (b.type === "loop") {
      result.push(...collectPlaySoundBlocks((b as LoopBlock).children));
    }
  }
  return result;
};

interface Props {
  alarm: Alarm;
  isVisible: boolean;
  onClose: () => void;
  onPlay: () => void;
  onStop: () => void;
  isRunning: boolean;
  activeBlockId: string | null;
}

const describeBlock = (block: Block, durations: Record<string, number>): string => {
  if (block.type === "wait") {
    const b = block as WaitBlock;
    return `Wait ${b.amount || 0} ${b.unit}`;
  }
  if (block.type === "waitUntil") {
    const b = block as WaitUntilBlock;
    return `Wait until ${b.time || "--:--"} ${b.ampm}`;
  }
  if (block.type === "playSound") {
    const b = block as PlaySoundBlock;
    return `Play sound – ${b.label || "Sound"}`;
  }
  if (block.type === "loop") {
    const b = block as LoopBlock;
    const count = b.repeat || 1;
    return `Loop ${count} time${count === 1 ? "" : "s"}`;
  }
  return "Step";
};

const BlockTree: React.FC<{
  blocks: Block[];
  activeBlockId: string | null;
  collapsedMap: Record<string, boolean>;
  onToggleLoop: (id: string) => void;
  durationsMap: Record<string, number>;
  depth?: number;
}> = ({ blocks, activeBlockId, collapsedMap, onToggleLoop, durationsMap, depth = 0 }) => {
  return (
    <>
      {blocks.map((block) => {
        const isActive = block.id === activeBlockId;
        const isLoop = block.type === "loop";
        const isCollapsed = isLoop ? collapsedMap[block.id] ?? true : false;
        return (
          <div key={block.id} className="mb-1 mt-1">
            <div
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs transition-all ${
                isActive
                  ? "bg-accent-100 text-accent-600 soft-glow"
                  : "bg-white/70 text-accent-500 shadow-accent-faint"
              }`}
              style={{ marginLeft: depth * 12 }}
            >
              <span>{describeBlock(block, durationsMap)}</span>
              {isLoop && (
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
            {isLoop && !isCollapsed && (
              <BlockTree
                blocks={(block as LoopBlock).children}
                activeBlockId={activeBlockId}
                collapsedMap={collapsedMap}
                onToggleLoop={onToggleLoop}
                durationsMap={durationsMap}
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
  alarm,
  isVisible,
  onClose,
  onPlay,
  onStop,
  isRunning,
  activeBlockId
}) => {
  const [collapsedMap, setCollapsedMap] = React.useState<Record<string, boolean>>({});
  const [showSteps, setShowSteps] = React.useState(false);
  const [soundDurations, setSoundDurations] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let cancelled = false;
    const loadDurations = async () => {
      const playBlocks = collectPlaySoundBlocks(alarm.blocks);
      const results = await Promise.all(
        playBlocks.map(
          (b) =>
            new Promise<{ id: string; duration?: number }>((resolve) => {
              const url = getSoundUrl(b);
              const audio = new Audio(url);
              const onLoaded = () => resolve({ id: b.id, duration: audio.duration });
              const onError = () => resolve({ id: b.id, duration: undefined });
              audio.addEventListener("loadedmetadata", onLoaded, { once: true });
              audio.addEventListener("error", onError, { once: true });
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
  }, [alarm.blocks]);

  const handleToggleLoop = (id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !(prev[id] ?? true)
    }));
  };

  const hasSelection = isVisible;
  const hasBlocks = alarm.blocks.length > 0;

  if (!isVisible) return null;

  return (
    <div className="w-full max-w-4xl mb-4 animate-slide-down-soft">
      <div className="pastel-card pastel-hover p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-accent-300">
              Play Menu
            </span>
            <span className="text-base font-semibold text-accent-600">
              {hasSelection ? alarm.name || "Selected Alarm" : "No alarm selected"}
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
                    blocks={alarm.blocks}
                    activeBlockId={activeBlockId}
                    collapsedMap={collapsedMap}
                    onToggleLoop={handleToggleLoop}
                    durationsMap={soundDurations}
                  />
                ) : (
                  <p className="text-xs text-accent-400">
                    This timer has no blocks yet. Edit it to add blocks.
                  </p>
                )
              ) : null}
            </>
          ) : (
            <p className="text-xs text-accent-400">No alarm selected. Choose a timer to play.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayMenu;
