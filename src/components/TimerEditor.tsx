import React, { useCallback, useMemo, useState } from "react";
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
  WaitUntilBlock
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

interface Props {
  timer: Timer;
  onBack: () => void;
  onSave: (timer: Timer) => void;
  activeBlockId?: string | null;
}

const TimerEditor: React.FC<Props> = ({ timer, onBack, onSave, activeBlockId }) => {
  const [draft, setDraft] = useImmer<Timer>(() => ({
    ...timer,
    mode: (timer as any).mode ?? "stopwatch"
  }));
  const [nameEdited, setNameEdited] = useState(false);
  const [overlayBlock, setOverlayBlock] = useState<Block | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<DragMeta | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 }
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 }
    })
  );

  const resetDrag = () => {
    setOverlayBlock(null);
    setIsDragActive(false);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragMeta | undefined;
    if (!data) return;
    setIsDragActive(true);
    setActiveDragData(data);
    if (data.kind === "existing") {
      const block = findBlockById(draft.blocks, data.blockId);
      if (block) setOverlayBlock(block);
      setDraggingBlockId(data.blockId);
    } else {
      setOverlayBlock(createDefaultBlock(data.blockType));
      setDraggingBlockId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = activeDragData;
    const overId = event.over?.id;
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
    isLast = false
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
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-xs text-accent-400">Repeat</span>
              {loop.repeat !== -1 && (
                <span className="text-xs text-accent-400">{loop.repeat} times</span>
              )}
              {loop.repeat === -1 && (
                <span className="text-xs text-accent-400 ml-auto pr-2">Forever</span>
              )}
            </div>
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
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-accent-400">Repeat</span>
            {loop.repeat !== -1 && (
              <>
                <input
                  type="number"
                  min={1}
                  className="soft-input max-w-[80px]"
                  value={loop.repeat}
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
                checked={loop.repeat === -1}
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
        ? "Notify Until"
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
        ref={dragProps?.setNodeRef}
        style={{
          ...dragProps?.style,
          ...(dragProps?.isDragging
            ? { display: "none" }
            : {
                opacity: dragProps?.style?.opacity ?? 1,
                visibility: dragProps?.style?.visibility ?? "visible"
              })
        }}
        className={`draggable-card pastel-card pastel-hover p-3 w-full ${
          isActive ? "ring-2 ring-accent-300" : ""
        }`}
        {...dragProps?.attributes}
      >
        <div 
          className="flex items-center justify-between mb-2"
          {...dragProps?.listeners}
        >
          <span className="text-xs text-accent-400 flex items-center gap-2 cursor-grab select-none">
            {headerLabel}
          </span>
          {!preview && (
            <button
              onClick={() => del(block.id)}
              className="soft-button bg-accent-50-90 text-accent-400 hover:bg-accent-100 text-xs px-3 py-1"
            >
              Remove
            </button>
          )}
        </div>

        {block.type === "wait" && <WaitBlockUI block={block as WaitBlock} mutateBlock={mutateBlock} />}
        {block.type === "waitUntil" && <WaitUntilBlockUI block={block as WaitUntilBlock} mutateBlock={mutateBlock} />}
        {block.type === "loop" && loopUi()}
        {block.type === "playSound" && <PlaySoundBlockUI block={block as PlaySoundBlock} mutateBlock={mutateBlock} draggingBlockId={draggingBlockId} />}
        {block.type === "playSoundUntil" && (
          <PlaySoundUntilBlockUI
            block={block as PlaySoundUntilBlock}
            mutateBlock={mutateBlock}
            draggingBlockId={draggingBlockId}
          />
        )}
        {block.type === "notify" && (
          <div className="flex flex-col gap-2 mt-2">
            <NotificationForm block={block as any} mutateBlock={mutateBlock} draggingBlockId={draggingBlockId} />
          </div>
        )}
        {block.type === "notifyUntil" && (
          <div className="flex flex-col gap-2 mt-2">
            <NotificationForm 
              block={block as any} 
              mutateBlock={mutateBlock} 
              draggingBlockId={draggingBlockId}
              showSoundControls
              showTimeoutControls
            />
          </div>
        )}
      </div>
    );

    if (preview) {
      return (
        <div key={block.id} className="relative min-w-0">
          {card()}
        </div>
      );
    }

    if (draggingBlockId === block.id) {
      return null;
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

  return (
    <div className="app-shell" style={{ touchAction: isDragActive ? "none" : "auto" }}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="w-full max-w-6xl flex flex-col pastel-card pastel-hover p-5 pt-4 pb-4">
          <div className="flex items-center justify-between mb-4 gap-3">
            <button onClick={onBack} className="soft-button-primary px-3 shrink-0">
              ← Back
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <select
                className="soft-input max-w-[140px] shrink-0"
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
                <option value="stopwatch">Stopwatch</option>
                <option value="alarm">Alarm</option>
              </select>
              <input
                className="soft-input max-w-[250px] text-center min-w-0"
                value={draft.name}
                onChange={(e) => {
                  setNameEdited(true);
                  setDraft((prev) => ({
                    ...prev,
                    name: e.target.value.slice(0, 20)
                  }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
            <button
              onClick={() => onSave(draft)}
              className="soft-button-primary shrink-0"
            >
              Save
            </button>
          </div>

          <div className="flex gap-4">
            <aside className="palette-column flex flex-col gap-2 items-stretch">
              {sidebarBlocks.map((b) => (
                <PaletteItem key={b.blockType} {...b} />
              ))}
            </aside>

            <main className="flex-1 rounded-xl border border-accent-100 bg-accent-50-70 p-3 min-h-[300px] flex flex-col">
              {visibleBlocks.length === 0 ? (
                <div className="relative flex-1">
                  <DropZone
                    id={buildDropId("root", "empty")}
                    className="rounded-lg flex-1 flex items-center justify-center"
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
                <div className="rounded-lg bg-accent-50-90 p-2 flex flex-col gap-2">
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

        <EditorDragOverlay
          block={overlayBlock}
          renderContent={(block) => renderBlock(block, 0, false, true)}
        />
      </DndContext>
    </div>
  );
};

export default TimerEditor;
