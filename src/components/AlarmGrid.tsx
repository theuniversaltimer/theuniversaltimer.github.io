import React from "react";
import type { Alarm } from "../types";
import AlarmCard from "./AlarmCard";

interface Props {
  alarms: Alarm[];
  onSelectAlarm: (alarm: Alarm) => void;
  onEditAlarm: (alarm: Alarm) => void;
  onDeleteAlarm: (alarm: Alarm, options?: { skipConfirm?: boolean }) => void;
  onCreateAlarm: () => void;
  activeAlarmId?: string | null;
}

const AlarmGrid: React.FC<Props> = ({
  alarms,
  onSelectAlarm,
  onEditAlarm,
  onDeleteAlarm,
  onCreateAlarm,
  activeAlarmId
}) => {
  return (
    <div className="w-full max-w-4xl mt-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {alarms.map((alarm) => (
          <AlarmCard
            key={alarm.id}
            alarm={alarm}
            isActive={alarm.id === activeAlarmId}
            onPlayMenu={() => onSelectAlarm(alarm)}
            onEdit={() => onEditAlarm(alarm)}
            onDelete={(skipConfirm) => onDeleteAlarm(alarm, { skipConfirm })}
          />
        ))}

        <button
          type="button"
          onClick={onCreateAlarm}
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

export default AlarmGrid;
