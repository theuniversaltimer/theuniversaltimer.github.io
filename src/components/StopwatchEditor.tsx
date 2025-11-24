import React, { useEffect, useMemo, useState } from "react";
import type { Timer, StopwatchLog } from "../types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { format as formatDate } from "date-fns";

interface Props {
  timer: Timer;
  onBack: () => void;
  onSave: (timer: Timer) => void;
}

dayjs.extend(duration);

const formatElapsed = (ms: number): string => {
  const d = dayjs.duration(ms);
  const hours = Math.floor(d.asHours());
  const minutes = d.minutes();
  const seconds = d.seconds();
  const base = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${base}`;
  }
  return base;
};

const formatLogTimestamp = (ms: number): string => formatDate(ms, "MM/dd/yy hh:mm:ss a");

const StopwatchEditor: React.FC<Props> = ({ timer, onBack, onSave }) => {
  const [name, setName] = useState(timer.name || "Stopwatch");
  const [logs, setLogs] = useState<StopwatchLog[]>(timer.logs ?? []);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  useEffect(() => {
    setName(timer.name || "Stopwatch");
    setLogs(timer.logs ?? []);
  }, [timer]);

  const handleExport = () => {
    const filename = `${(name || "stopwatch").replace(/[^a-z0-9]/gi, "-") || "stopwatch"}.json`;
    const data = JSON.stringify({ ...timer, name, logs }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hasUnsaved = useMemo(() => {
    return (
      name.trim() !== (timer.name || "Stopwatch") ||
      JSON.stringify(logs) !== JSON.stringify(timer.logs ?? [])
    );
  }, [name, logs, timer]);

  const handleBack = () => {
    if (hasUnsaved) {
      setShowUnsavedConfirm(true);
    } else {
      onBack();
    }
  };

  const handleSave = () => {
    const updated: Timer = {
      ...timer,
      name: name.trim() || "Stopwatch",
      logs
    };
    onSave(updated);
  };

  const handleDeleteLog = (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  const handleRenameLog = (id: string, value: string) => {
    setLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, name: value } : l))
    );
  };

  return (
    <div className="app-shell">
      <div className="w-full max-w-4xl pastel-card p-6 shadow-accent-soft">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent-300">
              Stopwatch Editor
            </p>
            <h2 className="text-xl font-semibold text-accent-600">
              {timer.name || "Stopwatch"}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleExport}
            className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 text-xs px-3 py-2 shrink-0"
            aria-label="Export stopwatch"
            title="Export stopwatch"
          >
            Export
          </button>
            <button
              type="button"
              onClick={handleBack}
              className="soft-button bg-accent-50 hover:bg-accent-100 text-accent-500"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="soft-button-primary"
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-accent-300 mb-1">
              Stopwatch name
            </p>
            <input
              type="text"
              className="soft-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stopwatch name"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-wide text-accent-300">
                Logs
              </p>
              <span className="text-xs text-accent-400">
                {logs.length ? `${logs.length} log${logs.length === 1 ? "" : "s"}` : "No logs yet"}
              </span>
            </div>
            {logs.length === 0 ? (
              <p className="text-xs text-accent-400">
                No logs yet. Press Mark in the play menu to add one.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {logs
                  .slice()
                  .sort((a, b) => b.loggedAt - a.loggedAt)
                  .map((log) => (
                    <div
                      key={log.id}
                      className="pastel-card p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wide text-accent-300">
                          {formatLogTimestamp(log.loggedAt)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLog(log.id)}
                          className="soft-button bg-accent-100 text-accent-500 hover:bg-accent-200 text-xs px-3 py-1"
                        >
                          Delete
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          className="soft-input"
                          value={log.name}
                          onChange={(e) => handleRenameLog(log.id, e.target.value)}
                          placeholder="Log name"
                        />
                        <span className="font-mono text-sm text-accent-600 whitespace-nowrap">
                          {formatElapsed(log.elapsedMs)}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showUnsavedConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm pointer-events-none" />
          <div className="fixed inset-0 z-40 overflow-y-scroll">
            <div className="min-h-screen flex items-start justify-center px-4 py-6 sm:py-12">
              <div className="pastel-card w-full max-w-sm shadow-accent-soft p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-accent-300">
                      Unsaved changes
                    </p>
                    <p className="text-base font-semibold text-accent-600">
                      Leave without saving?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUnsavedConfirm(false)}
                    className="soft-button bg-accent-50 hover:bg-accent-100 text-xs px-2 py-1"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-sm text-accent-400 mb-5">
                  You have unsaved changes. Leaving now will discard them.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowUnsavedConfirm(false)}
                    className="soft-button bg-accent-50 hover:bg-accent-100 text-accent-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onBack}
                    className="soft-button-primary"
                  >
                    Leave
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default StopwatchEditor;
