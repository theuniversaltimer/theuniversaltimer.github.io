import React, { useMemo, useState } from "react";
import type {
  Alarm,
  AlarmMode,
  Block,
  BlockType,
  LoopBlock,
  PlaySoundBlock,
  WaitBlock,
  WaitUntilBlock
} from "../types";
import { createId } from "../utils/ids";
import { sanitizeTimeInput } from "../utils/time";

interface Props {
  alarm: Alarm;
  onBack: () => void;
  onSave: (alarm: Alarm) => void;
  activeBlockId?: string | null;
}

type DragPayload =
  | { kind: "palette"; blockType: BlockType }
  | { kind: "existing"; blockId: string };

const DND_TYPE = "application/x-alarm-block";

const createDefaultBlock = (type: BlockType): Block => {
  switch (type) {
    case "wait":
      return {
        id: createId(),
        type: "wait",
        amount: 5,
        unit: "seconds"
      };
    case "waitUntil":
      return {
        id: createId(),
        type: "waitUntil",
        time: "07:00",
        ampm: "AM"
      };
    case "playSound":
      return {
        id: createId(),
        type: "playSound",
        soundType: "default",
        label: "Alarm"
      };
    case "loop":
    default:
      return {
        id: createId(),
        type: "loop",
        repeat: 2,
        children: []
      };
  }
};

function updateBlockTree(
  blocks: Block[],
  id: string,
  updater: (b: Block) => Block
): Block[] {
  return blocks.map((b) => {
    if (b.id === id) return updater(b);
    if (b.type === "loop") {
      return {
        ...(b as LoopBlock),
        children: updateBlockTree((b as LoopBlock).children, id, updater)
      };
    }
    return b;
  });
}

function deleteBlockTree(blocks: Block[], id: string): Block[] {
  const result: Block[] = [];
  for (const b of blocks) {
    if (b.id === id) continue;
    if (b.type === "loop") {
      result.push({
        ...(b as LoopBlock),
        children: deleteBlockTree((b as LoopBlock).children, id)
      });
    } else {
      result.push(b);
    }
  }
  return result;
}

type InsertPosition = "before" | "after" | "inside";

function insertRelative(
  blocks: Block[],
  targetId: string,
  newBlock: Block,
  position: InsertPosition
): Block[] {
  const result: Block[] = [];

  for (const b of blocks) {
    if (b.id === targetId) {
      if (position === "before") {
        result.push(newBlock, b);
      } else if (position === "after") {
        result.push(b, newBlock);
      } else if (position === "inside" && b.type === "loop") {
        result.push({
          ...(b as LoopBlock),
          children: [...(b as LoopBlock).children, newBlock]
        });
      } else {
        result.push(b);
      }
    } else if (b.type === "loop") {
      result.push({
        ...(b as LoopBlock),
        children: insertRelative(
          (b as LoopBlock).children,
          targetId,
          newBlock,
          position
        )
      });
    } else {
      result.push(b);
    }
  }

  return result;
}

function moveBlock(
  blocks: Block[],
  movingId: string,
  targetId: string,
  position: InsertPosition
): Block[] {
  if (movingId === targetId) return blocks;

  let movingBlock: Block | null = null;

  const find = (list: Block[]): void => {
    for (const b of list) {
      if (b.id === movingId) {
        movingBlock = b;
        return;
      }
      if (b.type === "loop") {
        find((b as LoopBlock).children);
      }
      if (movingBlock) return;
    }
  };

  find(blocks);
  if (!movingBlock) return blocks;

  const without = deleteBlockTree(blocks, movingId);
  return insertRelative(without, targetId, movingBlock, position);
}

const AlarmEditor: React.FC<Props> = ({ alarm, onBack, onSave }) => {
  const [draft, setDraft] = useState<Alarm>(() => ({
    ...alarm,
    mode: (alarm as any).mode ?? "stopwatch"
  }));
  const [nameEdited, setNameEdited] = useState(false);
  const [dragHoverId, setDragHoverId] = useState<string | null>(null);
  const [dragInsideLoopId, setDragInsideLoopId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<
    "between" | "inside" | null
  >(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [uploadHoverId, setUploadHoverId] = useState<string | null>(null);

  const clearDrag = () => {
    setDragHoverId(null);
    setDragInsideLoopId(null);
    setDragPosition(null);
    setDragOverRoot(false);
  };

  const parsePayload = (e: React.DragEvent): DragPayload | null => {
    try {
      return JSON.parse(e.dataTransfer.getData(DND_TYPE));
    } catch {
      return null;
    }
  };

  const handleDropOnBlock =
    (targetId: string, pos: InsertPosition) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const payload = parsePayload(e);
      clearDrag();
      if (!payload) return;

      if (payload.kind === "palette") {
        const block = createDefaultBlock(payload.blockType);
        setDraft((prev) => ({
          ...prev,
          blocks: insertRelative(prev.blocks, targetId, block, pos)
        }));
      } else {
        setDraft((prev) => ({
          ...prev,
          blocks: moveBlock(prev.blocks, payload.blockId, targetId, pos)
        }));
      }
    };

  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = parsePayload(e);
    clearDrag();
    if (!payload) return;

    if (payload.kind === "palette") {
      const block = createDefaultBlock(payload.blockType);
      setDraft((prev) => ({
        ...prev,
        blocks: [...prev.blocks, block]
      }));
      return;
    }

    setDraft((prev) => {
      if (!prev.blocks.length) {
        return prev;
      }
      const last = prev.blocks[prev.blocks.length - 1];
      return {
        ...prev,
        blocks: moveBlock(prev.blocks, payload.blockId, last.id, "after")
      };
    });
  };

  const onRootDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DND_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    clearDrag();
    setDragOverRoot(true);
  };

  const sidebarBlocks = useMemo(
    () => [
      { type: "loop" as BlockType, label: "Loop", desc: "Repeat blocks" },
      { type: "wait" as BlockType, label: "Wait", desc: "Pause duration" },
      { type: "waitUntil" as BlockType, label: "Wait Until", desc: "Pause until time" },
      { type: "playSound" as BlockType, label: "Play Sound", desc: "Play audio" }
    ],
    []
  );

  const handleChange = (id: string, updater: (b: Block) => Block) => {
    setDraft((prev) => ({
      ...prev,
      blocks: updateBlockTree(prev.blocks, id, updater)
    }));
  };

  const del = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      blocks: deleteBlockTree(prev.blocks, id)
    }));
  };

  const renderBlock = (
    block: Block,
    depth = 0,
    suppressOuterLine = false
  ): React.ReactNode => {
    const loopUi = () => {
      const b = block as LoopBlock;
      const empty = b.children.length === 0;

      return (
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-accent-400">Repeat</span>
            <select
              className="soft-input max-w-[120px]"
              value={b.repeat === -1 ? "forever" : "count"}
              onChange={(e) => {
                const mode = e.target.value;
                handleChange(block.id, (prev) => ({
                  ...(prev as LoopBlock),
                  repeat: mode === "forever" ? -1 : Math.max(1, Number((prev as LoopBlock).repeat) || 1)
                }));
              }}
            >
              <option value="count">Times</option>
              <option value="forever">Forever</option>
            </select>
            {b.repeat !== -1 && (
              <>
                <input
                  type="number"
                  min={1}
                  className="soft-input max-w-[80px]"
                  value={b.repeat}
                  onChange={(e) =>
                    handleChange(block.id, (prev) => ({
                      ...(prev as LoopBlock),
                      repeat: Math.max(1, Number(e.target.value) || 1)
                    }))
                  }
                />
                <span className="text-xs text-accent-400">times</span>
              </>
            )}
            {b.repeat === -1 && (
              <span className="text-xs text-accent-400">forever</span>
            )}
          </div>

          {empty && (
            <div
              className={`rounded-xl bg-accent-50-70 p-3 transition-all ${
                dragInsideLoopId === block.id && dragPosition === "inside"
                  ? "drag-hover"
                  : ""
              }`}
              onDrop={handleDropOnBlock(block.id, "inside")}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DND_TYPE)) return;
                e.preventDefault();
                e.stopPropagation();
                setDragInsideLoopId(block.id);
                setDragPosition("inside");
                setDragHoverId(block.id);
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                clearDrag();
              }}
            >
              <p className="text-[11px] text-accent-300 text-center select-none">
                Drag blocks here to include them in this loop.
              </p>
            </div>
          )}

          {!empty && (
            <div className="flex flex-col">
              <div
                className="relative h-5 my-0"
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes(DND_TYPE)) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverId(block.id + "_top");
                  setDragPosition("inside");
                  setDragInsideLoopId(null);
                }}
                onDragLeave={(e) => {
                  e.stopPropagation();
                  clearDrag();
                }}
                onDrop={(e) => {
                  handleDropOnBlock(b.children[0].id, "before")(e);
                }}
              >
                {dragHoverId === block.id + "_top" &&
                  dragPosition === "inside" && (
                    <div
                      className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                      style={{
                        backgroundColor: "rgba(var(--accent-400), 0.55)",
                        boxShadow: "0 2px 8px rgba(var(--shadow-soft), 0.2)"
                      }}
                    />
                  )}
              </div>

              {b.children.map((child) => (
                <React.Fragment key={child.id}>
                  {renderBlock(child, depth + 1, true)}

                  <div
                    className="relative h-5 my-0"
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes(DND_TYPE)) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setDragHoverId(child.id + "_after");
                      setDragPosition("inside");
                      setDragInsideLoopId(null);
                    }}
                    onDragLeave={(e) => {
                      e.stopPropagation();
                      clearDrag();
                    }}
                    onDrop={(e) => {
                      handleDropOnBlock(child.id, "after")(e);
                    }}
                  >
                    {dragHoverId === child.id + "_after" &&
                      dragPosition === "inside" && (
                        <div
                          className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                          style={{
                            backgroundColor: "rgba(var(--accent-400), 0.55)",
                            boxShadow: "0 2px 8px rgba(var(--shadow-soft), 0.2)"
                          }}
                        />
                      )}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      );
    };

    const waitUi = () => {
      const b = block as WaitBlock;
      return (
        <div className="flex gap-2 items-center mt-2">
          <input
            type="number"
            min={0}
            className="soft-input max-w-[80px]"
            value={b.amount}
            onChange={(e) =>
              handleChange(block.id, (prev) => ({
                ...(prev as WaitBlock),
                amount: Number(e.target.value)
              }))
            }
          />
          <select
            className="soft-input"
            value={b.unit}
            onChange={(e) =>
              handleChange(block.id, (prev) => ({
                ...(prev as WaitBlock),
                unit: e.target.value as WaitBlock["unit"]
              }))
            }
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      );
    };

    const waitUntilUi = () => {
      const b = block as WaitUntilBlock;
      return (
        <div className="flex gap-2 items-center mt-2">
          {(() => {
            const safe = sanitizeTimeInput(b.time, "07:00");
            const [hh, mm] = safe.split(":");
            const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
            const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));
            return (
              <>
                <select
                  className="soft-input max-w-[90px]"
                  value={hh}
                  onChange={(e) =>
                    handleChange(block.id, (prev) => ({
                      ...(prev as WaitUntilBlock),
                      time: `${e.target.value}:${mm}`
                    }))
                  }
                >
                  {hours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-accent-400">:</span>
                <select
                  className="soft-input max-w-[90px]"
                  value={mm}
                  onChange={(e) =>
                    handleChange(block.id, (prev) => ({
                      ...(prev as WaitUntilBlock),
                      time: `${hh}:${e.target.value}`
                    }))
                  }
                >
                  {minutes.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </>
            );
          })()}
          <select
            className="soft-input max-w-[70px]"
            value={b.ampm}
            onChange={(e) =>
              handleChange(block.id, (prev) => ({
                ...(prev as WaitUntilBlock),
                ampm: e.target.value as any
              }))
            }
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>
      );
    };

    const soundUi = () => {
      const b = block as PlaySoundBlock;
      const soundType =
        b.soundType === "custom" ? "url" : b.soundType ?? "default";

      const handleFileSelect = (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
          handleChange(block.id, (prev) => ({
            ...(prev as PlaySoundBlock),
            customUrl: typeof reader.result === "string" ? reader.result : undefined,
            label: file.name || (prev as PlaySoundBlock).label
          }));
        };
        reader.readAsDataURL(file);
      };

      const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
          handleFileSelect(file);
        }
      };

      const dropProps =
        soundType === "upload"
          ? {
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                setUploadHoverId(block.id);
              },
              onDragLeave: (e: React.DragEvent) => {
                e.preventDefault();
                setUploadHoverId(null);
              },
              onDrop: (e: React.DragEvent) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleFileSelect(file);
                setUploadHoverId(null);
              }
            }
          : {};

      return (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex gap-2 items-center min-w-0">
            <select
              className="soft-input max-w-[140px]"
              value={soundType}
              onChange={(e) =>
                handleChange(block.id, (prev) => ({
                  ...(prev as PlaySoundBlock),
                  soundType: e.target.value as PlaySoundBlock["soundType"]
                }))
              }
            >
              <option value="default">Default</option>
              <option value="url">URL</option>
              <option value="upload">Upload</option>
            </select>
            {soundType === "default" && (
              <select
                className="soft-input flex-1 min-w-0 w-full"
                value={b.label || "Alarm"}
                onChange={(e) =>
                  handleChange(block.id, (prev) => ({
                    ...(prev as PlaySoundBlock),
                    label: e.target.value
                  }))
                }
              >
                <option value="Alarm">Alarm</option>
              </select>
            )}
            {soundType === "url" && (
              <input
                className="soft-input flex-1"
                placeholder="https://example.com/audio.mp3"
                value={b.customUrl || ""}
                onChange={(e) =>
                  handleChange(block.id, (prev) => ({
                    ...(prev as PlaySoundBlock),
                    customUrl: e.target.value
                  }))
                }
              />
            )}
            {soundType === "upload" && (
              <div
                className={`soft-input flex-1 border-dashed cursor-pointer text-sm text-accent-500 ${
                  uploadHoverId === block.id ? "drag-hover" : ""
                }`}
                {...dropProps}
                onClick={() =>
                  document.getElementById(`file-${block.id}`)?.click()
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-accent-500 truncate">
                    {b.customUrl ? b.label || "Audio file loaded" : "Upload or drag a sound file"}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-accent-400">
                    Choose File
                  </span>
                </div>
                <input
                  id={`file-${block.id}`}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>
            )}
          </div>
        </div>
      );
    };

    const header = (
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-accent-400">
          {block.type === "wait"
            ? "Wait"
            : block.type === "waitUntil"
            ? "Wait Until"
            : block.type === "playSound"
            ? "Play Sound"
            : "Loop"}
        </span>
        <button
          onClick={() => del(block.id)}
          className="soft-button bg-accent-50-90 text-accent-400 hover:bg-accent-100 text-xs px-3 py-1"
        >
          Remove
        </button>
      </div>
    );

    return (
      <div key={block.id} className="relative min-w-0">
        <div
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData(
              DND_TYPE,
              JSON.stringify({ kind: "existing", blockId: block.id })
            )
          }
          className="pastel-card pastel-hover p-3 cursor-move"
        >
          {header}
          {block.type === "wait" && waitUi()}
          {block.type === "waitUntil" && waitUntilUi()}
          {block.type === "loop" && loopUi()}
          {block.type === "playSound" && soundUi()}
        </div>

        {!suppressOuterLine && (
          <div
            className="relative h-5 my-0"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(DND_TYPE)) return;
              e.preventDefault();
              e.stopPropagation();
              setDragHoverId(block.id);
              setDragPosition("between");
              setDragInsideLoopId(null);
              setDragOverRoot(false);
            }}
            onDragLeave={(e) => {
              e.stopPropagation();
              clearDrag();
            }}
            onDrop={handleDropOnBlock(block.id, "after")}
          >
            {dragHoverId === block.id && dragPosition === "between" && (
              <div
                className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                style={{
                  backgroundColor: "rgba(var(--accent-400), 0.55)",
                  boxShadow: "0 2px 8px rgba(var(--shadow-soft), 0.2)"
                }}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-shell">
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
                const nextMode = e.target.value as AlarmMode;
                setDraft((prev) => {
                  const updated = { ...prev, mode: nextMode };
                  const prevMode = (prev as any).mode ?? "stopwatch";
                  const prevDefault =
                    prevMode === "stopwatch" ? "New Timer" : "New Alarm";
                  const nextDefault =
                    nextMode === "stopwatch" ? "New Timer" : "New Alarm";
                  if (
                    !nameEdited &&
                    prev.name.trim().toLowerCase() ===
                      prevDefault.toLowerCase()
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
                setDraft((prev) => ({ ...prev, name: e.target.value }));
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
          <aside className="w-56 flex flex-col gap-2 shrink-0">
            {sidebarBlocks.map((b) => (
              <div
                key={b.type}
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData(
                    DND_TYPE,
                    JSON.stringify({ kind: "palette", blockType: b.type })
                  )
                }
                className="pastel-card pastel-hover p-3 cursor-grab"
              >
                <div className="text-sm font-semibold text-accent-600">
                  {b.label}
                </div>
                <div className="text-xs text-accent-400">{b.desc}</div>
              </div>
            ))}
          </aside>

          <main className="flex-1 min-w-0 rounded-xl border border-accent-100 bg-accent-50-70 p-3 overflow-y-auto">
            <div
              className={`rounded-lg transition-all min-h-[235px] ${
                draft.blocks.length === 0
                  ? `flex items-center justify-center ${dragOverRoot ? "drag-hover" : ""}`
                  : ""
              }`}
              onDrop={draft.blocks.length === 0 ? handleDropOnRoot : undefined}
              onDragOver={draft.blocks.length === 0 ? onRootDragOver : undefined}
              onDragLeave={(e) => {
                e.stopPropagation();
                setDragOverRoot(false);
              }}
            >
              {draft.blocks.length > 0 && (
                <div
                  className="relative h-5 my-0"
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes(DND_TYPE)) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setDragHoverId("__TOP__");
                    setDragPosition("between");
                    setDragInsideLoopId(null);
                    setDragOverRoot(false);
                  }}
                  onDragLeave={(e) => {
                    e.stopPropagation();
                    clearDrag();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const payload = parsePayload(e);
                    clearDrag();
                    if (!payload) return;

                    if (payload.kind === "palette") {
                      const block = createDefaultBlock(payload.blockType);
                      setDraft((prev) => ({
                        ...prev,
                        blocks: [block, ...prev.blocks]
                      }));
                    } else {
                      setDraft((prev) => {
                        if (!prev.blocks.length) return prev;
                        const first = prev.blocks[0];
                        return {
                          ...prev,
                          blocks: moveBlock(
                            prev.blocks,
                            payload.blockId,
                            first.id,
                            "before"
                          )
                        };
                      });
                    }
                  }}
                >
                  {dragHoverId === "__TOP__" &&
                    dragPosition === "between" && (
                      <div
                        className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                        style={{
                          backgroundColor: "rgba(var(--accent-400), 0.55)",
                          boxShadow: "0 2px 8px rgba(var(--shadow-soft), 0.2)"
                        }}
                      />
                    )}
                </div>
              )}

              {draft.blocks.length === 0 ? (
                <p className="text-xs text-accent-400 text-center">
                  Drag blocks here to build your timer.
                </p>
              ) : (
                draft.blocks.map((block) => renderBlock(block))
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AlarmEditor;
