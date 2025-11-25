import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  pointerWithin,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { useImmer } from "use-immer";
import type {
  Timer,
  TimerMode,
  Block,
  BlockType,
  LoopBlock,
  PlaySoundBlock,
  PlaySoundUntilBlock,
  WaitBlock,
  WaitUntilBlock,
  NotifyUntilBlock
} from "../types";
import {
  applyExistingDrop,
  applyPaletteDrop,
  buildDropId,
  createDefaultBlock,
  deleteBlockTree,
  findBlockById,
  DragMeta,
  parseDropId
} from "./editor/blockTree";
import {
  DraggableCard,
  DropLine,
  DropZone,
  EditorDragOverlay,
  PaletteItem,
  StandardDropZone,
  getBlockLabel
} from "./editor/dndPrimitives";
import {
  WaitBlockUI,
  WaitUntilBlockUI,
  PlaySoundBlockUI,
  PlaySoundUntilBlockUI,
  NotificationForm
} from "./editor/blockComponents";
import { useDispatch, useSelector } from 'react-redux';
import { updateTimer } from '../store/timersSlice'; // adjust import path if different
import { useTimerUtils } from '../hooks/useTimerUtils';

// NEW: select timer from store so we can verify post-dispatch state
const TimerSelector = (state: any, id?: string) =>
  id ? state.timers?.items?.find((t: any) => t.id === id) : undefined;

interface Props {
  timer: Timer;
  onBack: () => void;
  onSave: (timer: Timer) => void;
  activeBlockId?: string | null;
}

const normalizeTimer = (t: Timer): Timer => ({
  ...t,
  mode: (t as any).mode ?? "stopwatch"
});

const timersEqual = (a: Timer, b: Timer): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const TimerEditor: React.FC<Props> = ({ timer, onBack, onSave, activeBlockId }) => {
  const [draft, setDraft] = useImmer<Timer>(() => normalizeTimer(timer));
  const [nameEdited, setNameEdited] = useState(false);
  const [overlayBlock, setOverlayBlock] = useState<Block | null>(null);
  const [overlayWidth, setOverlayWidth] = useState<number | undefined>(undefined);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragMeta | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [builderMinHeight, setBuilderMinHeight] = useState(400);
  const blockSizeRef = useRef<Map<string, number>>(new Map());
  const blockNodeRefs = useRef<Map<string, HTMLElement>>(new Map());
  const initialTimerRef = useRef<Timer>(normalizeTimer(timer));
  const savedThisSessionRef = useRef<string | null>(null);
  const appliedEditedForRef = useRef<string | null>(null);
  const prevTimerIdRef = useRef<string | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const builderRef = useRef<HTMLDivElement | null>(null);
  const getBuilderWidth = useCallback(
    () => Math.max((builderRef.current?.clientWidth ?? 0) - 45, 350),
    []
  );

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 }
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  );

  useEffect(() => {
    initialTimerRef.current = normalizeTimer(timer);
  }, [timer]);

  const hasUnsavedChanges = useMemo(() => {
    return !timersEqual(normalizeTimer(draft), initialTimerRef.current);
  }, [draft]);

  const resetDrag = () => {
    setOverlayBlock(null);
    setIsDragActive(false);
    setOverlayWidth(undefined);
  };

  const handleExport = () => {
    const filename = `${(draft.name || "timer").replace(/[^a-z0-9]/gi, "-") || "timer"}.json`;
    const data = JSON.stringify(draft, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragMeta | undefined;
    if (!data) return;
    setIsDragActive(true);
    setActiveDragData(data);
    if (data.kind === "existing") {
      const block = findBlockById(draft.blocks, data.blockId);
      if (block) setOverlayBlock(block);
      const measuredWidth = blockSizeRef.current.get(data.blockId);
      setOverlayWidth(measuredWidth);
      setDraggingBlockId(data.blockId);
    } else {
      setOverlayBlock(createDefaultBlock(data.blockType));
      setOverlayWidth(getBuilderWidth());
      setDraggingBlockId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = activeDragData;
    const overId = event.over?.id;
    
    // Check if dropped on delete zone
    if (overId === "delete-zone" && data && data.kind === "existing") {
      setDraft((draftState) => {
        draftState.blocks = deleteBlockTree(draftState.blocks, data.blockId);
      });
      resetDrag();
      setDraggingBlockId(null);
      setActiveDragData(null);
      return;
    }
    
    const drop = typeof overId === "string" ? parseDropId(overId) : null;

    if (data && drop) {
      if (data.kind === "palette") {
        const block = createDefaultBlock(data.blockType);
        setDraft((draftState) => {
          draftState.blocks = applyPaletteDrop(draftState.blocks, block, drop);
        });
      } else {
        setDraft((draftState) => {
          draftState.blocks = applyExistingDrop(
            draftState.blocks,
            data.blockId,
            drop
          );
        });
      }
    }

    resetDrag();
    setDraggingBlockId(null);
    setActiveDragData(null);
  };

  const handleDragCancel = () => {
    resetDrag();
    setDraggingBlockId(null);
    setActiveDragData(null);
    setIsDragActive(false);
  };

  useEffect(() => {
    const measureHeights = () => {
      const paletteHeight = paletteRef.current?.getBoundingClientRect().height;
      if (paletteHeight && paletteHeight > 0) {
        setBuilderMinHeight(Math.max(400, paletteHeight + 200));
      } else {
        setBuilderMinHeight((prev) => Math.max(400, prev));
      }
    };
    measureHeights();
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, []);

  const handleBackClick = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
      return;
    }
    onBack();
  };

  const handleConfirmLeave = () => {
    setShowUnsavedConfirm(false);
    onBack();
  };

  const handleCancelLeave = () => {
    setShowUnsavedConfirm(false);
  };

  useEffect(() => {
    const handleResize = () => {
      blockNodeRefs.current.forEach((el, id) => {
        blockSizeRef.current.set(id, el.getBoundingClientRect().width);
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarBlocks = useMemo(
    () => [
      { blockType: "loop" as BlockType, label: getBlockLabel("loop"), desc: "Repeat blocks" },
      { blockType: "wait" as BlockType, label: getBlockLabel("wait"), desc: "Pause duration" },
      { blockType: "waitUntil" as BlockType, label: getBlockLabel("waitUntil"), desc: "Pause until time" },
      { blockType: "playSound" as BlockType, label: getBlockLabel("playSound"), desc: "Play audio" },
      { blockType: "playSoundUntil" as BlockType, label: getBlockLabel("playSoundUntil"), desc: "Play audio and wait until it ends" },
      { blockType: "notify" as BlockType, label: getBlockLabel("notify"), desc: "Show a notification" },
      { blockType: "notifyUntil" as BlockType, label: getBlockLabel("notifyUntil"), desc: "Notify and loop sound until dismissed or timeout" }
    ],
    []
  );

  const mutateBlock = useCallback(
    (id: string, mutator: (b: Block) => void) => {
      setDraft((draftState) => {
        const target = findBlockById(draftState.blocks, id);
        if (target) {
          mutator(target);
        }
      });
    },
    [setDraft]
  );

  const del = useCallback(
    (id: string) => {
      setDraft((draftState) => {
        draftState.blocks = deleteBlockTree(draftState.blocks, id);
      });
    },
    [setDraft]
  );

  const renderBlock = (
    block: Block,
    depth = 0,
    suppressOuterLine = false,
    preview = false,
    isLast = false,
    showPreviewActions = false,
    disableDragWrapper = false,
    ignoreDraggingHide = false
  ): React.ReactNode => {
    const loopUi = () => {
      const loop = block as LoopBlock;
      const visibleChildren = draggingBlockId
        ? loop.children.filter((c) => c.id !== draggingBlockId)
        : loop.children;
      const empty = visibleChildren.length === 0;

      if (preview) {
        return (
          <div className="flex flex-col gap-2">
            {!empty && (
              <div className="flex flex-col">
                {loop.children.map((child) => (
                  <React.Fragment key={child.id}>
                    {renderBlock(child, depth + 1, true, true)}
                  </React.Fragment>
                ))}
              </div>
            )}
            {empty && (
            <div className="rounded-xl bg-accent-50-70 p-3">
                <p className="text-[11px] text-accent-300 text-center select-none">
                  Drag blocks here to include them in this loop.
                </p>
              </div>
            )}
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-2">
          {empty && (
            <DropZone
              id={buildDropId(loop.id, "inside")}
              className="rounded-xl bg-accent-50-70 p-3 transition-all"
              activeClassName="outline outline-2 outline-dashed outline-accent-200"
            >
              {() => (
                <div className="rounded-xl">
                  <p className="text-[11px] text-accent-300 text-center select-none">
                    Drag blocks here to include them in this loop.
                  </p>
                </div>
              )}
            </DropZone>
          )}

          {!empty && (
            <div className="flex flex-col">
              {visibleChildren.length > 0 && (
                <StandardDropZone id={buildDropId(visibleChildren[0].id, "before")} />
              )}

              {loop.children.map((child, idx) => {
                const visibleIdx = visibleChildren.findIndex((c) => c.id === child.id);
                const isLastVisible = visibleIdx === visibleChildren.length - 1;
                  return (
                    <React.Fragment key={child.id}>
                      {renderBlock(child, depth + 1, true, false)}
                      {!isLastVisible && visibleIdx !== -1 && (
                        <StandardDropZone id={buildDropId(child.id, "after")} />
                      )}
                    </React.Fragment>
                  );
                })}

                <StandardDropZone id={buildDropId(loop.id, "inside")} />
              </div>
          )}
        </div>
      );
    };

    const notifyUntilUi = () => {
      const notify = block as NotifyUntilBlock;
      const children = notify.children || [];
      const visibleChildren = draggingBlockId
        ? children.filter((c) => c.id !== draggingBlockId)
        : children;
      const empty = visibleChildren.length === 0;

      const childList = preview ? (
        <div className="flex flex-col gap-2">
          {children.length === 0 ? (
            <div className="rounded-xl bg-accent-50-70 p-3">
              <p className="text-[11px] text-accent-300 text-center select-none">
                Drag blocks here to include them in this loop.
              </p>
            </div>
          ) : (
            children.map((child) => (
              <React.Fragment key={child.id}>
                {renderBlock(child, depth + 1, true, true)}
              </React.Fragment>
            ))
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {empty && (
            <DropZone
              id={buildDropId(notify.id, "inside")}
              className="rounded-xl bg-accent-50-70 p-3 transition-all"
              activeClassName="outline outline-2 outline-dashed outline-accent-200"
            >
              {() => (
                <div className="rounded-xl">
                  <p className="text-[11px] text-accent-300 text-center select-none">
                    Drag blocks here to include them in this loop.
                  </p>
                </div>
              )}
            </DropZone>
          )}

          {!empty && (
            <div className="flex flex-col">
              {visibleChildren.length > 0 && (
                <StandardDropZone id={buildDropId(visibleChildren[0].id, "before")} />
              )}

              {children.map((child) => {
                const visibleIdx = visibleChildren.findIndex((c) => c.id === child.id);
                const isLastVisible = visibleIdx === visibleChildren.length - 1;
                return (
                  <React.Fragment key={child.id}>
                    {renderBlock(child, depth + 1, true, false)}
                    {!isLastVisible && visibleIdx !== -1 && (
                      <StandardDropZone id={buildDropId(child.id, "after")} />
                    )}
                  </React.Fragment>
                );
              })}

              <StandardDropZone id={buildDropId(notify.id, "inside")} />
            </div>
          )}
        </div>
      );

      return (
        <div className="flex flex-col gap-2 mt-2">
          {!preview && (
            <NotificationForm
              block={notify}
              mutateBlock={mutateBlock}
              draggingBlockId={draggingBlockId}
            />
          )}
          {childList}
        </div>
      );
    };

    const headerLabel =
      block.type === "wait"
        ? "Wait"
        : block.type === "waitUntil"
        ? "Wait Until"
        : block.type === "playSound"
        ? "Play Sound"
        : block.type === "playSoundUntil"
        ? "Play Sound Until"
        : block.type === "notify"
        ? "Notify"
        : block.type === "notifyUntil"
        ? "Notify"
        : "Loop";

    const isActive = activeBlockId === block.id;

    const card = (dragProps?: {
      setNodeRef?: (el: HTMLElement | null) => void;
      attributes?: any;
      listeners?: any;
      style?: React.CSSProperties;
      isDragging?: boolean;
    }) => (
      <div
        ref={(el) => {
          if (!dragProps?.setNodeRef) return;
          dragProps.setNodeRef(el);
          if (el) {
            blockNodeRefs.current.set(block.id, el);
            blockSizeRef.current.set(block.id, el.getBoundingClientRect().width);
          } else {
            blockNodeRefs.current.delete(block.id);
            blockSizeRef.current.delete(block.id);
          }
        }}
        style={{
          ...dragProps?.style,
          ...(dragProps?.isDragging
            ? { display: "none" }
            : {
                opacity: dragProps?.style?.opacity ?? 1,
                visibility: dragProps?.style?.visibility ?? "visible"
              })
        }}
        className={`draggable-card pastel-card pastel-hover p-3 w-full relative z-20 ${
          isActive ? "ring-2 ring-accent-300" : ""
        }`}
        {...dragProps?.attributes}
        {...dragProps?.listeners}
      >
        <div 
          className="flex items-center justify-between mb-2"
        >
          {block.type === "loop" ? (
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span className="text-xs text-accent-400 cursor-grab select-none">
                {headerLabel}
              </span>
              {(block as LoopBlock).repeat !== -1 && (
                <>
                  <input
                    type="number"
                    min={1}
                    className="soft-input loop-input soft-number"
                    value={(block as LoopBlock).repeat}
                    onChange={(e) =>
                      mutateBlock(block.id, (prev) => {
                        (prev as LoopBlock).repeat = Math.max(
                          1,
                          Number(e.target.value) || 1
                        );
                      })
                    }
                  />
                  <span className="text-xs text-accent-400">times</span>
                </>
              )}
              <label className="flex items-center gap-1 text-xs text-accent-400 ml-auto pr-2 select-none">
                <input
                  type="checkbox"
                  checked={(block as LoopBlock).repeat === -1}
                  onChange={(e) =>
                    mutateBlock(block.id, (prev) => {
                      (prev as LoopBlock).repeat = e.target.checked
                        ? -1
                        : Math.max(1, Number((prev as LoopBlock).repeat) || 1);
                    })
                  }
                  className="accent-accent-500 h-4 w-4"
                />
                <span>Forever</span>
              </label>
            </div>
          ) : block.type === "wait" ? (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <span className="text-xs text-accent-400 cursor-grab select-none shrink-0">
                {headerLabel}
              </span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <WaitBlockUI block={block as WaitBlock} mutateBlock={mutateBlock} />
              </div>
            </div>
          ) : block.type === "waitUntil" ? (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <span className="text-xs text-accent-400 cursor-grab select-none shrink-0">
                {headerLabel}
              </span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <WaitUntilBlockUI block={block as WaitUntilBlock} mutateBlock={mutateBlock} />
              </div>
            </div>
          ) : block.type === "playSound" ? (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <span className="text-xs text-accent-400 cursor-grab select-none shrink-0">
                {headerLabel}
              </span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <PlaySoundBlockUI block={block as PlaySoundBlock} mutateBlock={mutateBlock} draggingBlockId={draggingBlockId} />
              </div>
            </div>
          ) : block.type === "playSoundUntil" ? (
            <div className="flex items-center gap-3 flex-wrap flex-1">
              <span className="text-xs text-accent-400 cursor-grab select-none shrink-0">
                {headerLabel}
              </span>
              <div className="flex items-center gap-2 flex-wrap flex-1">
                <PlaySoundUntilBlockUI
                  block={block as PlaySoundUntilBlock}
                  mutateBlock={mutateBlock}
                  draggingBlockId={draggingBlockId}
                />
              </div>
            </div>
          ) : block.type === "notifyUntil" ? (
            <div className="flex items-center gap-2 flex-wrap flex-1 text-xs text-accent-400">
              <span className="cursor-grab select-none shrink-0">{headerLabel}</span>
              <span className="shrink-0">for</span>
              <input
                type="number"
                min={1}
                step={1}
                aria-label="Notify for seconds"
                className="soft-input soft-number w-[80px]"
                value={Math.round(((block as NotifyUntilBlock).timeoutMs ?? 10000) / 1000)}
                data-no-drag
                onChange={(e) =>
                  mutateBlock(block.id, (prev) => {
                    (prev as NotifyUntilBlock).timeoutMs =
                      Math.max(1000, Number(e.target.value) || 10) * 1000;
                  })
                }
              />
              <span className="shrink-0">seconds</span>
            </div>
          ) : block.type === "notify" ? (
            <span className="text-xs text-accent-400 flex items-center gap-2 cursor-grab select-none">
              {headerLabel}
            </span>
          ) : (
            <span className="text-xs text-accent-400 flex items-center gap-2 cursor-grab select-none">
              {headerLabel}
            </span>
          )}
        </div>

        {block.type === "loop" && loopUi()}
        {block.type === "notify" && (
          <div className="flex flex-col gap-2 mt-2">
            <NotificationForm block={block as any} mutateBlock={mutateBlock} draggingBlockId={draggingBlockId} />
          </div>
        )}
        {block.type === "notifyUntil" && notifyUntilUi()}
      </div>
    );

    if (preview) {
      return (
        <div key={block.id} className="relative min-w-0">
          {card()}
        </div>
      );
    }

    if (draggingBlockId === block.id && !ignoreDraggingHide) {
      return null;
    }

    if (disableDragWrapper) {
      return (
        <div key={block.id} className="relative min-w-0">
          {card()}
        </div>
      );
    }

    return (
      <div 
        key={block.id} 
        className="relative min-w-0"
      >
        <DraggableCard
          id={`block:${block.id}`}
          data={{ kind: "existing", blockId: block.id } as DragMeta}
        >
          {({ setNodeRef, attributes, listeners, style, isDragging }) =>
            card({
              setNodeRef,
              attributes,
              listeners,
              style,
              isDragging
            })
          }
        </DraggableCard>

        {!suppressOuterLine && !isLast && (
          <StandardDropZone id={buildDropId(block.id, "after")} />
        )}
      </div>
    );
  };

  const visibleBlocks = draggingBlockId
    ? draft.blocks.filter((b) => b.id !== draggingBlockId)
    : draft.blocks;

  const editorLabel =
    (draft as any).mode === "alarm"
      ? "Alarm Editor"
      : "Timer Editor";

  const dispatch = useDispatch();
  const storeTimer = useSelector((s: any) =>
    timer?.id ? s.timers?.items?.find((t: any) => t.id === timer.id) : undefined
  );
  const { isLikelyStopwatch: checkStopwatch, isPaused, buildRestartPayload } = useTimerUtils();

  const handleSave = (edited?: Timer) => {
    const source = edited ?? draft;

    if (checkStopwatch(source)) {
      dispatch(updateTimer({ id: source.id, ...source }));
      initialTimerRef.current = normalizeTimer({ ...source });
      setDraft((d) => ({ ...d, ...source }));
      onSave({ ...source });
      return;
    }

    const payload = buildRestartPayload(source);

    payload.edited = true;
    setDraft((d) => ({ ...d, ...payload }));
    dispatch(updateTimer(payload));
    savedThisSessionRef.current = String(payload.id);
    appliedEditedForRef.current = String(payload.id);
    initialTimerRef.current = normalizeTimer(payload);
    onSave(payload);

    setTimeout(() => {
      const latest = storeTimer;
      if (!latest) return;
      if (isPaused(latest)) {
        const forced = buildRestartPayload(latest, Date.now());
        forced.edited = true;
        dispatch(updateTimer(forced));
      }
    }, 120);
  };


  useEffect(() => {
    if (!timer?.id) return;

    if (prevTimerIdRef.current !== timer.id) {
      prevTimerIdRef.current = timer.id;
      savedThisSessionRef.current = null;
      appliedEditedForRef.current = null;
    }

    if (appliedEditedForRef.current === timer.id) return;

    if (!timer.edited) return;
    if (savedThisSessionRef.current === String(timer.id)) {
      return;
    }

    const isLikelyStopwatch =
      timer.duration == null && timer.nextTrigger == null && timer.scheduledAt == null;
    if (isLikelyStopwatch) return;

    appliedEditedForRef.current = timer.id;
    const now = Date.now();
    const payload: any = { ...timer, paused: false, edited: false, id: timer.id };

    if (timer.duration != null) {
      payload.startedAt = now;
      payload.remaining = timer.duration;
    } else if (timer.nextTrigger != null || timer.scheduledAt != null || timer.time != null) {
      const candidate = timer.nextTrigger ?? timer.scheduledAt ?? timer.time;
      payload.nextTrigger = Math.max(Number(candidate) || now, now);
      payload.startedAt = now;
    } else {
      payload.startedAt = now;
    }

    setDraft(() => normalizeTimer(payload));
    dispatch(updateTimer(payload));
    initialTimerRef.current = normalizeTimer(payload);
  }, [timer?.id, timer?.edited]);

  return (
    <div className="app-shell" style={{ touchAction: isDragActive ? "none" : "auto" }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
      <div className="w-full max-w-4xl flex flex-col pastel-card pastel-hover p-6">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] uppercase tracking-wide text-accent-300">
                {editorLabel}
              </p>
              <input
                className="soft-input w-full text-xl font-semibold text-accent-600"
                value={draft.name}
                placeholder="New Timer"
                onChange={(e) => {
                  setNameEdited(true);
                  setDraft((prev) => ({
                    ...prev,
                    name: e.target.value.slice(0, 20)
                  }));
                }}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-1 max-w-xs">
              <p className="text-[11px] uppercase tracking-wide text-accent-300">
                Timer type
              </p>
              <select
                className="soft-input w-full"
                value={(draft as any).mode ?? "stopwatch"}
                onChange={(e) => {
                  const nextMode = e.target.value as TimerMode;
                  setDraft((prev) => {
                    const updated = { ...prev, mode: nextMode };
                    const prevMode = (prev as any).mode ?? "stopwatch";
                    const prevDefault =
                      prevMode === "stopwatch" ? "New Timer" : "New Timer";
                    const nextDefault =
                      nextMode === "stopwatch" ? "New Timer" : "New Timer";
                    if (
                      !nameEdited &&
                      prev.name.trim().toLowerCase() === prevDefault.toLowerCase()
                    ) {
                      return { ...updated, name: nextDefault };
                    }
                    return updated;
                  });
                }}
              >
                <option value="stopwatch">Timer</option>
                <option value="alarm">Alarm</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col gap-2 flex-shrink-0">
              <p className="text-[11px] uppercase tracking-wide text-accent-300 pl-1">
                Block palette
              </p>
              {isDragActive ? (
                <DropZone
                  id="delete-zone"
                  className="palette-column flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors h-full min-h-[530px] border-accent-200 bg-accent-50"
                  activeClassName="border-accent-300 bg-accent-100"
                >
                  {(isOver) => (
                    <span
                      className={`text-xs font-medium ${
                        isOver ? "text-accent-600" : "text-accent-400"
                      }`}
                    >
                      🗑️ Drop to delete
                    </span>
                  )}
                </DropZone>
              ) : (
                <aside className="palette-column flex flex-col gap-2 items-stretch">
                  {sidebarBlocks.map((b) => (
                    <PaletteItem key={b.blockType} {...b} />
                  ))}
                </aside>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-accent-300 pl-1">
                Timer builder
              </p>
              <div className="max-h-[530px] overflow-auto" ref={builderRef}>
                >
                  {(isOver) => (
                    <span
                      className={`text-xs font-medium ${
                        isOver ? "text-accent-600" : "text-accent-400"
                      }`}
                    >
                      🗑️ Drop to delete
                    </span>
                  )}
                </DropZone>
              ) : (
                <aside className="palette-column flex flex-col gap-2 items-stretch">
                  {sidebarBlocks.map((b) => (
                    <PaletteItem key={b.blockType} {...b} />
                  ))}
                </aside>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-accent-300 pl-1">
                Timer builder
              </p>
              <div className="max-h-[530px] overflow-auto" ref={builderRef}>
                <main className="rounded-xl border border-accent-100 bg-accent-50-70 p-3 min-h-[530px] flex flex-col min-w-[350px]">
                  {visibleBlocks.length === 0 ? (
                    <div className="relative flex-1 min-h-[320px]">
                      <DropZone
                        id={buildDropId("root", "empty")}
                        className="absolute inset-0 rounded-lg flex items-center justify-center border border-dashed border-accent-100 bg-accent-50-90"
                        activeClassName="outline outline-2 outline-dashed outline-accent-200"
                      >
                        {() => (
                          <p className="text-xs text-accent-400 text-center px-4 py-2 rounded-lg">
                            Drag blocks here to build your timer.
                          </p>
                        )}
                      </DropZone>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-accent-50-90 p-2 flex flex-col gap-0">
                      <StandardDropZone id={buildDropId("root", "prepend")} />

                      {visibleBlocks.map((block, idx) => (
                        <React.Fragment key={block.id}>
                          {renderBlock(
                            block,
                            0,
                            false,
                            false,
                            idx === visibleBlocks.length - 1
                          )}
                        </React.Fragment>
                      ))}

                      <StandardDropZone id={buildDropId("root", "append")} />
                    </div>
                  )}
                </main>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-6 gap-2">
            <div>
              <button
                onClick={handleBackClick}
                className="soft-button-primary px-3 shrink-0"
              >
                ← Back
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="soft-button-primary"
                aria-label="Export timer"
                title="Export timer"
              >
                Export
              </button>
              <button
                onClick={() => handleSave(draft)}
                className="soft-button-primary shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <EditorDragOverlay
          block={overlayBlock}
          width={overlayWidth}
          renderContent={(block) =>
            renderBlock(block, 0, false, false, false, true, true, true)
          }
        />

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
                      onClick={handleCancelLeave}
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
                      onClick={handleCancelLeave}
                      className="soft-button bg-accent-50 hover:bg-accent-100 text-accent-500"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmLeave}
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
      </DndContext>
    </div>
  );
};

export default TimerEditor;
