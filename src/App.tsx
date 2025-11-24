import React, { useEffect, useState } from "react";
import { useTimers } from "./hooks/useTimers";
import { useMultiTimerRunner } from "./hooks/useMultiTimerRunner";
import type { Timer, ThemeName, StopwatchLog } from "./types";
import TimerGrid from "./components/TimerGrid";
import PlayMenu from "./components/PlayMenu";
import TimerEditor from "./components/TimerEditor";
import StopwatchEditor from "./components/StopwatchEditor";
import ThemeBar from "./components/ThemeBar";
import { sanitizeTimeInput } from "./utils/time";
import { createId } from "./utils/ids";
import { format } from "date-fns";
import { TimerSchema } from "./schemas/timer";
import {
  makeWait,
  makeWaitUntil,
  makeNotifyUntil,
  makeLoop,
  buildTimer
} from "./utils/timerTemplates";

type View = "grid" | "editor";

const formatLogName = (ms: number): string => format(ms, "MM/dd/yy hh:mm:ss a");

const App: React.FC = () => {
  const { timers, createTimer, updateTimer, deleteTimer, ready } = useTimers();
  const [view, setView] = useState<View>("grid");
  const [selectedTimerId, setSelectedTimerId] = useState<string | null>(null);
  const [editorTimerId, setEditorTimerId] = useState<string | null>(null);
  const [pendingNewTimerId, setPendingNewTimerId] = useState<string | null>(null);
  const [timerPendingDelete, setTimerPendingDelete] = useState<Timer | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<
    "timer" | "alarm" | "daily" | "pomodoro" | "custom" | "stopwatch" | "import" | null
  >("timer");
  const [quickMinutes, setQuickMinutes] = useState(5);
  const [quickSeconds, setQuickSeconds] = useState(0);
  const [pomoWorkMinutes, setPomoWorkMinutes] = useState(25);
  const [pomoBreakMinutes, setPomoBreakMinutes] = useState(5);
  const [alarmTime, setAlarmTime] = useState("07:00");
  const [alarmAmpm, setAlarmAmpm] = useState<"AM" | "PM">("AM");
  const [importCsvText, setImportCsvText] = useState<string>("");
  const [tempEditorTimer, setTempEditorTimer] = useState<Timer | null>(null);
  const [hasStartedMap, setHasStartedMap] = useState<Record<string, boolean>>({});
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window !== "undefined") {
      return ((localStorage.getItem("alarm-theme") as ThemeName) || "dark") as ThemeName;
    }
    return "dark";
  });

  const {
    isRunning,
    getActiveBlockId,
    getRemainingMs,
    getElapsedMs,
    start,
    pause,
    restart,
    stop,
    resetStopwatch
  } = useMultiTimerRunner();

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (showTemplatePicker || timerPendingDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showTemplatePicker, timerPendingDelete]);

  const selectedTimer: Timer | undefined = timers.find(
    (t) => t.id === selectedTimerId
  );

  const editorTimerFromState: Timer | undefined = timers.find(
    (t) => t.id === editorTimerId
  );
  const editorTimer =
    editorTimerFromState ??
    (tempEditorTimer?.id === editorTimerId ? tempEditorTimer : tempEditorTimer ?? undefined);

  const handlePlaySelected = () => {
    if (!selectedTimer) return;
    setHasStartedMap((prev) => ({ ...prev, [selectedTimer.id]: true }));
    start(selectedTimer);
  };

  const handlePauseSelected = () => {
    if (!selectedTimer) return;
    pause(selectedTimer);
  };

  const handleRestartSelected = () => {
    if (!selectedTimer) return;
    if (selectedTimer.mode === "simpleStopwatch") {
      resetStopwatch(selectedTimer.id);
      stop(selectedTimer.id);
      setHasStartedMap((prev) => ({ ...prev, [selectedTimer.id]: false }));
    } else {
      setHasStartedMap((prev) => ({ ...prev, [selectedTimer.id]: true }));
      restart(selectedTimer);
    }
  };

  const handleMarkSelected = () => {
    if (!selectedTimer || selectedTimer.mode !== "simpleStopwatch") return;
    const elapsed = getElapsedMs(selectedTimer.id) ?? 0;
    const loggedAt = Date.now();
    const entry = {
      id: createId(),
      name: formatLogName(loggedAt),
      elapsedMs: elapsed,
      loggedAt
    } as StopwatchLog;
    const updated: Timer = {
      ...selectedTimer,
      logs: [...(selectedTimer.logs ?? []), entry]
    };
    updateTimer(updated);
  };

  const parseImportedAlarms = (text: string): Array<{
    name: string;
    time: string;
    ampm: "AM" | "PM";
    repeat: "once" | "daily";
  }> => {
    const rows = text
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (!rows.length) return [];

    const headers = rows[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = headers.indexOf("name");
    const timeIdx = headers.indexOf("time");
    const ampmIdx = headers.indexOf("ampm");
    const repeatIdx = headers.indexOf("repeat");

    const entries: Array<{
      name: string;
      time: string;
      ampm: "AM" | "PM";
      repeat: "once" | "daily";
    }> = [];

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(",").map((c) => c.trim());
      if (timeIdx === -1 || cells.length <= timeIdx) continue;
      const rawTime = cells[timeIdx] || "";
      const safeTime = sanitizeTimeInput(rawTime, "07:00");
      const ampmVal =
        ampmIdx !== -1 && cells[ampmIdx]
          ? (cells[ampmIdx].toUpperCase() === "PM" ? "PM" : "AM")
          : "AM";
      const repeatVal =
        repeatIdx !== -1 && cells[repeatIdx].toLowerCase() === "daily"
          ? "daily"
          : "once";
      const nameVal =
        nameIdx !== -1 && cells[nameIdx]
          ? cells[nameIdx]
          : `Imported Alarm ${entries.length + 1}`;

      entries.push({
        name: nameVal,
        time: safeTime,
        ampm: ampmVal,
        repeat: repeatVal
      });
    }

    return entries;
  };

  const handleImportCsv = () => {
    const parsed = parseImportedAlarms(importCsvText);
    if (!parsed.length) {
      alert("No alarms found in CSV. Expected headers: name,time,ampm,repeat.");
      return;
    }

    parsed.forEach(({ name, time, ampm, repeat }) => {
      const timer = createTimer();
      if (!timer) return;

      const waitUntilBlock = makeWaitUntil(time, ampm);
      const notifyUntilBlock = makeNotifyUntil(
        repeat === "daily" ? "Daily alarm" : "Alarm",
        "Alarm is about to play.",
        60000
      );

      const blocks =
        repeat === "daily"
          ? [makeLoop(-1, [waitUntilBlock, notifyUntilBlock])]
          : [waitUntilBlock, notifyUntilBlock];

      const updated = buildTimer(timer, name, "alarm", blocks);
      updateTimer(updated);
    });

    setImportCsvText("");
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setSelectedTemplate("timer");
    setShowTemplatePicker(false);
    setView("grid");
  };

  const handleLogSelected = () => {
    if (!selectedTimer || selectedTimer.mode !== "simpleStopwatch") return;
    const elapsed = getElapsedMs(selectedTimer.id) ?? 0;
    setLogsMap((prev) => {
      const existing = prev[selectedTimer.id] ?? [];
      return { ...prev, [selectedTimer.id]: [...existing, elapsed] };
    });
    setHasStartedMap((prev) => ({ ...prev, [selectedTimer.id]: true }));
    start(selectedTimer);
  };

  const handleEditTimer = (timer: Timer) => {
    if (timer.locked) return;
    if (isRunning(timer.id)) {
      stop(timer.id);
    }
    setPendingNewTimerId(null);
    setEditorTimerId(timer.id);
    setView("editor");
  };

  const handleSaveTimer = (draft: Timer) => {
    try {
      const parsed = TimerSchema.parse(draft) as Timer;
      updateTimer(parsed);
      setPendingNewTimerId((prev) => (prev === draft.id ? null : prev));
      setEditorTimerId(null);
      setTempEditorTimer(null);
      setView("grid");
    } catch (err: any) {
      const message =
        err?.errors?.map((e: any) => e.message).join("; ") ||
        "Please check your timer inputs.";
      alert(`Validation failed: ${message}`);
    }
  };

  const handleDeleteTimer = (timer: Timer) => {
    if (isRunning(timer.id)) {
      stop(timer.id);
    }
    if (selectedTimerId === timer.id) {
      setSelectedTimerId(null);
    }
    deleteTimer(timer.id);
    setTimerPendingDelete(null);
    setHasStartedMap((prev) => {
      const next = { ...prev };
      delete next[timer.id];
      return next;
    });
  };

  const handleBackFromEditor = () => {
    if (editorTimerId && pendingNewTimerId === editorTimerId) {
      deleteTimer(editorTimerId);
      if (selectedTimerId === editorTimerId) {
        setSelectedTimerId(null);
      }
    }
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setView("grid");
  };

  const handleCreateQuickTimer = () => {
    const normalizedMinutes = Math.max(0, Math.min(59, Math.floor(Number(quickMinutes) || 0)));
    const normalizedSeconds = Math.max(0, Math.min(59, Math.floor(Number(quickSeconds) || 0)));
    let totalSeconds = normalizedMinutes * 60 + normalizedSeconds;
    if (totalSeconds === 0) {
      totalSeconds = 60;
      setQuickMinutes(1);
      setQuickSeconds(0);
    }

    const timer = createTimer();
    if (!timer) return;

    const waitBlockUnit =
      normalizedSeconds === 0 ? "minutes" : normalizedMinutes === 0 ? "seconds" : "seconds";
    const waitBlockAmount =
      normalizedSeconds === 0
        ? Math.max(1, normalizedMinutes)
        : normalizedMinutes === 0
        ? normalizedSeconds
        : totalSeconds;

    const blocks = [
      makeWait(waitBlockAmount, waitBlockUnit),
      makeNotifyUntil("Timer complete", "")
    ];

    const updated = buildTimer(timer, "Quick Timer", "stopwatch", blocks);

    updateTimer(updated);
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setSelectedTimerId(updated.id);
    setShowTemplatePicker(false);
    setSelectedTemplate("timer");
    setView("grid");
  };

  const handleCreateStopwatch = () => {
    const timer = createTimer();
    if (!timer) return;

    const updated: Timer = {
      ...timer,
      name: "Stopwatch",
      mode: "simpleStopwatch",
      blocks: [],
      locked: false,
      logs: []
    };

    updateTimer(updated);
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setSelectedTimerId(updated.id);
    setShowTemplatePicker(false);
    setSelectedTemplate("timer");
    setView("grid");
  };

  const handleCreatePomodoro = () => {
    const timer = createTimer();
    if (!timer) return;

    const workMinutes = Math.max(1, Math.min(180, Math.floor(Number(pomoWorkMinutes) || 25)));
    const breakMinutes = Math.max(1, Math.min(120, Math.floor(Number(pomoBreakMinutes) || 5)));

    const work = makeWait(workMinutes, "minutes");
    const shortBreak = makeWait(breakMinutes, "minutes");
    const loop = makeLoop(4, [
      work,
      makeNotifyUntil("Work complete", "A chime will play now.", 5000),
      shortBreak,
      makeNotifyUntil("Break complete", "A chime will play now.", 5000)
    ]);

    const updated = buildTimer(timer, "Pomodoro", "stopwatch", [loop]);

    updateTimer(updated);
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setSelectedTimerId(updated.id);
    setShowTemplatePicker(false);
    setSelectedTemplate("timer");
    setView("grid");
  };

  const handleCreateQuickAlarm = (repeatDaily: boolean) => {
    const safeTime = sanitizeTimeInput(alarmTime, "07:00");
    const [hh, mm] = safeTime.split(":");

    const timer = createTimer();
    if (!timer) return;

    const waitUntilBlock = makeWaitUntil(`${hh}:${mm}`, alarmAmpm);
    const notifyUntilBlock = makeNotifyUntil(
      repeatDaily ? "Daily alarm" : "Alarm",
      "Alarm is about to play.",
      60000
    );

    const blocks = repeatDaily
      ? [makeLoop(-1, [waitUntilBlock, notifyUntilBlock])]
      : [waitUntilBlock, notifyUntilBlock];

    const updated = buildTimer(
      timer,
      repeatDaily ? "Daily Alarm" : "Quick Alarm",
      "alarm",
      blocks
    );

    updateTimer(updated);
    setPendingNewTimerId(null);
    setEditorTimerId(null);
    setTempEditorTimer(null);
    setSelectedTimerId(updated.id);
    setShowTemplatePicker(false);
    setSelectedTemplate("timer");
    setView("grid");
  };

  const handleCreateCustomTimer = () => {
    const timer = createTimer();
    if (!timer) return;
    setTempEditorTimer(timer);
    setPendingNewTimerId(timer.id);
    setEditorTimerId(timer.id);
    setShowTemplatePicker(false);
    setSelectedTemplate("timer");
    setView("editor");
  };

  const handleCreateSelectedTemplate = () => {
    if (selectedTemplate === "timer") {
      handleCreateQuickTimer();
    } else if (selectedTemplate === "alarm") {
      handleCreateQuickAlarm(false);
    } else if (selectedTemplate === "daily") {
      handleCreateQuickAlarm(true);
    } else if (selectedTemplate === "pomodoro") {
      handleCreatePomodoro();
    } else if (selectedTemplate === "stopwatch") {
      handleCreateStopwatch();
    } else if (selectedTemplate === "import") {
      handleImportCsv();
    } else if (selectedTemplate === "custom") {
      handleCreateCustomTimer();
    }
  };

  useEffect(() => {
    if (view === "editor") {
      setShowTemplatePicker(false);
      setSelectedTemplate("timer");
    }
  }, [view]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (typeof window !== "undefined") {
      localStorage.setItem("alarm-theme", theme);
      document.title = "Universal Timer";
    }
  }, [theme]);

  const safeAlarmTime = sanitizeTimeInput(alarmTime, "07:00");
  const [alarmHh, alarmMm] = safeAlarmTime.split(":");
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  return (
    <>
      {!ready && (
        <div className="app-shell animate-fade-in-up">
          <div className="w-full max-w-4xl pastel-card pastel-hover p-6 text-center">
            <p className="text-sm text-accent-400">Loading timers…</p>
          </div>
        </div>
      )}

      {ready && view === "grid" && (
        <div className="app-shell animate-fade-in-up">
          <div className="w-full max-w-4xl mb-4 text-center">
            <h1 className="text-2xl sm:text-3xl font-semibold text-accent-600 mb-1">
              Universal Timer
            </h1>
            <p className="text-xs sm:text-sm text-accent-400">
              Build flexible, sequence-based timers. Infinitely customizable!
            </p>
          </div>

          <PlayMenu
            timer={selectedTimer ?? timers[0] ?? { id: "", name: "", blocks: [] }}
            isVisible={!!selectedTimer}
            activeBlockId={getActiveBlockId(selectedTimerId)}
            isRunning={isRunning(selectedTimerId)}
            remainingMs={selectedTimerId ? getRemainingMs(selectedTimerId) : null}
            elapsedMs={selectedTimerId ? getElapsedMs(selectedTimerId) : null}
            hasStarted={selectedTimerId ? !!hasStartedMap[selectedTimerId] : false}
            onClose={() => setSelectedTimerId(null)}
            onPlay={handlePlaySelected}
            onPause={handlePauseSelected}
            onRestart={handleRestartSelected}
            onLog={handleMarkSelected}
          />

          <TimerGrid
            timers={timers}
            activeTimerId={selectedTimerId ?? undefined}
            onSelectTimer={(timer) => setSelectedTimerId(timer.id)}
            onEditTimer={handleEditTimer}
            onDeleteTimer={(timer, options) => {
              const skipConfirm = options?.skipConfirm;
              if (skipConfirm) {
                handleDeleteTimer(timer);
                return;
              }
              setTimerPendingDelete(timer);
            }}
            onCreateTimer={() => {
              setSelectedTemplate("timer");
              setShowTemplatePicker(true);
            }}
            isTimerRunning={isRunning}
          />
        </div>
      )}

      {ready && view === "editor" && editorTimer && (
        editorTimer.mode === "simpleStopwatch" ? (
          <StopwatchEditor
            timer={editorTimer}
            onBack={handleBackFromEditor}
            onSave={handleSaveTimer}
          />
        ) : (
          <TimerEditor timer={editorTimer} onBack={handleBackFromEditor} onSave={handleSaveTimer} />
        )
      )}

      <ThemeBar theme={theme} onChange={setTheme} />

      <footer className="fixed bottom-3 right-4 z-20">
        <div className="inline-flex items-center gap-2 rounded-full bg-accent-50-90 border border-accent-100 px-3 py-1 text-[11px] sm:text-xs text-accent-400 shadow-accent-faint backdrop-blur">
          <a
            href="https://github.com/theuniversaltimer/theuniversaltimer.github.io"
            className="font-medium text-accent-500 hover:text-accent-600"
            target="_blank"
            rel="noreferrer"
          >
            GitHub repo
          </a>
          <span className="text-accent-300">•</span>
          <a
            href="https://github.com/theuniversaltimer/theuniversaltimer.github.io/blob/main/LICENSE"
            className="hover:text-accent-500"
            target="_blank"
            rel="noreferrer"
          >
            MIT License
          </a>
        </div>
      </footer>

      {view === "grid" && showTemplatePicker && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm pointer-events-none" />
          <div className="fixed inset-0 z-40 overflow-y-scroll">
          <div className="min-h-screen flex items-start justify-center px-4 py-6 sm:py-12">
            <div className="pastel-card w-full max-w-4xl shadow-accent-soft p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-accent-300">
                  Choose a template
                </p>
                <p className="text-base font-semibold text-accent-600">
                  Start quickly with a preset or build your own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTemplatePicker(false);
                  setSelectedTemplate("timer");
                }}
                className="soft-button bg-accent-50 hover:bg-accent-100 text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 items-start">
              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "alarm" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("alarm")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Quick Alarm
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Rings at a set time.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "timer" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("timer")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Quick Timer
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Runs for a set time.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "stopwatch" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("stopwatch")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Stopwatch
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Counts up from zero.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "daily" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("daily")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Daily Alarm
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Rings daily at a set time.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "pomodoro" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("pomodoro")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Pomodoro Timer
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Work/break cycles for focused sessions.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "import" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("import")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Import Alarms
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Upload a CSV with multiple alarms.
                </p>
              </button>

              <button
                type="button"
                className={`pastel-card pastel-hover text-left p-4 h-full items-start min-w-[140px] ${
                  selectedTemplate === "custom" ? "soft-glow" : ""
                }`}
                onClick={() => setSelectedTemplate("custom")}
              >
                <p className="text-sm font-semibold text-accent-600 mb-1 whitespace-nowrap">
                  Custom Timer
                </p>
                <p className="text-xs text-accent-400 min-h-[32px] leading-tight">
                  Open the editor to build your own timer or import CSV.
                </p>
              </button>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-3 items-stretch">
              {selectedTemplate === "timer" && (
                <div className="pastel-card p-3 flex-1 min-w-[260px]">
                  <p className="text-xs uppercase tracking-wide text-accent-300 mb-1">
                    Duration
                  </p>
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <span className="text-[11px] uppercase tracking-wide text-accent-300">
                        Minutes
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="soft-input w-full"
                        value={quickMinutes}
                        onChange={(e) =>
                          setQuickMinutes(
                            Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)))
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <span className="text-[11px] uppercase tracking-wide text-accent-300">
                        Seconds
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        className="soft-input w-full"
                        value={quickSeconds}
                        onChange={(e) =>
                          setQuickSeconds(
                            Math.max(0, Math.min(59, Math.floor(Number(e.target.value) || 0)))
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {(selectedTemplate === "alarm" || selectedTemplate === "daily") && (
                <div className="pastel-card p-3 flex-1 min-w-[260px]">
                  <p className="text-xs uppercase tracking-wide text-accent-300 mb-1">
                    Alarm time
                  </p>
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[120px]">
                      <select
                        className="soft-input w-full"
                        value={alarmHh}
                        onChange={(e) =>
                          setAlarmTime((prev) => {
                            const [, prevMm] = sanitizeTimeInput(prev, "07:00").split(":");
                            return `${e.target.value}:${prevMm}`;
                          })
                        }
                      >
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-accent-400 pb-2">:</span>
                    <div className="flex-1 min-w-[120px]">
                      <select
                        className="soft-input w-full"
                        value={alarmMm}
                        onChange={(e) =>
                          setAlarmTime((prev) => {
                            const [prevH] = sanitizeTimeInput(prev, "07:00").split(":");
                            return `${prevH}:${e.target.value}`;
                          })
                        }
                      >
                        {minuteOptions.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <select
                        className="soft-input w-full"
                        value={alarmAmpm}
                        onChange={(e) => setAlarmAmpm(e.target.value as "AM" | "PM")}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {selectedTemplate === "import" && (
                <div className="pastel-card p-3 flex-1 min-w-[260px]">
                  <p className="text-xs uppercase tracking-wide text-accent-300 mb-1">
                    Upload CSV
                  </p>
                  <div className="flex flex-col gap-2">
                    <label
                      className="soft-input text-center cursor-pointer"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (!file) return;
                        file.text().then((t) => setImportCsvText(t));
                      }}
                    >
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          file.text().then((t) => setImportCsvText(t));
                        }}
                      />
                      Drag or click to upload CSV
                    </label>
                    <textarea
                      className="soft-input min-h-[120px]"
                      value={importCsvText}
                      onChange={(e) => setImportCsvText(e.target.value)}
                      placeholder="name,time,ampm,repeat&#10;Morning Alarm,07:00,AM,daily"
                    />
                    <p className="text-[11px] text-accent-400">
                      Headers: name,time,ampm,repeat. Repeat supports "daily" or "once".
                    </p>
                  </div>
                </div>
              )}

              {selectedTemplate === "pomodoro" && (
                <div className="pastel-card p-3 flex-1 min-w-[260px]">
                  <p className="text-xs uppercase tracking-wide text-accent-300 mb-1">
                    Pomodoro settings
                  </p>
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <span className="text-[11px] uppercase tracking-wide text-accent-300">
                        Work (minutes)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={180}
                        className="soft-input w-full"
                        value={pomoWorkMinutes}
                        onChange={(e) =>
                          setPomoWorkMinutes(
                            Math.max(1, Math.min(180, Math.floor(Number(e.target.value) || 0)))
                          )
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
                      <span className="text-[11px] uppercase tracking-wide text-accent-300">
                        Break (minutes)
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        className="soft-input w-full"
                        value={pomoBreakMinutes}
                        onChange={(e) =>
                          setPomoBreakMinutes(
                            Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 0)))
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full flex justify-end items-end gap-2">
                <button
                  type="button"
                  className="soft-button bg-accent-50 hover:bg-accent-100 text-accent-500"
                  onClick={() => {
                    setSelectedTemplate("timer");
                    setShowTemplatePicker(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="soft-button-primary"
                  disabled={!selectedTemplate}
                  onClick={handleCreateSelectedTemplate}
                >
                  {selectedTemplate === "timer" && "Create Quick Timer"}
                  {selectedTemplate === "stopwatch" && "Create Stopwatch"}
                  {selectedTemplate === "import" && "Import Alarms"}
                  {selectedTemplate === "alarm" && "Create Quick Alarm"}
                  {selectedTemplate === "daily" && "Create Daily Alarm"}
                  {selectedTemplate === "pomodoro" && "Create Pomodoro Timer"}
                  {selectedTemplate === "custom" && "Create Custom Timer"}
                </button>
              </div>
            </div>
          </div>
          </div>
          </div>
        </>
      )}

      {timerPendingDelete && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm pointer-events-none" />
          <div className="fixed inset-0 z-40 overflow-y-scroll">
          <div className="min-h-screen flex items-start justify-center px-4 py-6 sm:py-12">
            <div className="pastel-card w-full max-w-sm shadow-accent-soft p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-accent-300">
                  Confirm delete
                </p>
                <p className="text-base font-semibold text-accent-600">
                  Delete “{timerPendingDelete.name || "Untitled Timer"}”?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTimerPendingDelete(null)}
                className="soft-button bg-accent-50 hover:bg-accent-100 text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-accent-400 mb-5">
              This will remove the timer and all its blocks. This can&apos;t be undone.
            </p>
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-accent-300 -mt-1">
                Tip: hold Shift while deleting to skip this warning.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTimerPendingDelete(null)}
                  className="soft-button bg-accent-50 hover:bg-accent-100 text-accent-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTimer(timerPendingDelete)}
                  className="soft-button-primary"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
          </div>
          </div>
        </>
      )}
    </>
  );
};

export default App;
