import React from "react";
import type { Alarm } from "../types";

interface Props {
  alarm: Alarm;
  onPlayMenu: () => void;
  onEdit: () => void;
  onDelete: (skipConfirm: boolean) => void;
  isActive?: boolean;
}

const AlarmCard: React.FC<Props> = ({
  alarm,
  onPlayMenu,
  onEdit,
  onDelete,
  isActive
}) => {
  const countBlocks = (blocks: Alarm["blocks"]): number =>
    blocks.reduce((sum, b) => {
      if (b.type === "loop") {
        return sum + 1 + countBlocks((b as any).children || []);
      }
      return sum + 1;
    }, 0);

  const blockCount = countBlocks(alarm.blocks);

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onPlayMenu();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onPlayMenu}
      onKeyDown={handleKey}
      className={`pastel-card pastel-hover flex flex-col items-start gap-3 p-4 text-left transition-all ${
        isActive ? "soft-glow" : ""
      }`}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-accent-300">
            {alarm.mode === "stopwatch" ? "Stopwatch" : "Alarm"}
          </span>
          <span className="text-base font-semibold text-accent-600">
            {alarm.name || "Untitled Alarm"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 text-xs px-3 py-1"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e.shiftKey);
            }}
            className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 text-xs px-3 py-1"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-xs text-accent-400">
        {blockCount
          ? `${blockCount} block${blockCount === 1 ? "" : "s"}`
          : "No blocks yet"}
      </p>
    </div>
  );
};

export default AlarmCard;
