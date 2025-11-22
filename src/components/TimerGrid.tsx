import React from "react";
import type { Timer } from "../types";
import TimerCard from "./TimerCard";

interface Props {
  timers: Timer[];
  onSelectTimer: (timer: Timer) => void;
  onEditTimer: (timer: Timer) => void;
  onDeleteTimer: (timer: Timer, options?: { skipConfirm?: boolean }) => void;
  onCreateTimer: () => void;
  activeTimerId?: string | null;
  isTimerRunning?: (id: string | null | undefined) => boolean;
}

const TimerGrid: React.FC<Props> = ({
  timers,
  onSelectTimer,
  onEditTimer,
  onDeleteTimer,
  onCreateTimer,
  activeTimerId,
  isTimerRunning
}) => {
  return (
    <div className="w-full max-w-4xl mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {timers.map((timer) => (
          <TimerCard
            key={timer.id}
            timer={timer}
            isActive={timer.id === activeTimerId}
            isPlaying={isTimerRunning?.(timer.id) ?? false}
            onPlayMenu={() => onSelectTimer(timer)}
            onEdit={() => onEditTimer(timer)}
            onDelete={(skipConfirm) => onDeleteTimer(timer, { skipConfirm })}
          />
        ))}

        <button
          type="button"
          onClick={onCreateTimer}
          className="pastel-card pastel-hover flex flex-col items-center justify-center gap-2 p-4 border-dashed border-2 border-accent-100 bg-accent-50-60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-500 text-xl">
            +
          </div>
          <span className="text-sm font-medium text-accent-500">
            Create New Timer
          </span>
        </button>
      </div>
    </div>
  );
};

export default TimerGrid;
