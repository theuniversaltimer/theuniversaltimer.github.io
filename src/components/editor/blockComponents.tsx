import React from "react";
import type {
  Block,
  WaitBlock,
  WaitUntilBlock,
  PlaySoundBlock,
  PlaySoundUntilBlock,
  NotifyBlock,
  NotifyUntilBlock
} from "../../types";
import { sanitizeTimeInput } from "../../utils/time";
import { TIME_UNITS } from "./blockConstants";
import { AudioDropWrapper } from "./audioDropWrapper";

interface BlockMutator {
  (id: string, mutator: (b: Block) => void): void;
}

interface NotificationFormProps {
  block: NotifyBlock | NotifyUntilBlock;
  mutateBlock: BlockMutator;
  draggingBlockId: string | null;
  showSoundControls?: boolean;
  showTimeoutControls?: boolean;
}

export const NotificationForm: React.FC<NotificationFormProps> = ({
  block,
  mutateBlock,
  draggingBlockId,
  showSoundControls = false,
  showTimeoutControls = false
}) => {
  const fileToDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : undefined);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });

  const notification = block as any;
  const soundType = notification.soundType === "custom" ? "url" : notification.soundType ?? "default";

  return (
    <>
      <input
        className="soft-input"
        placeholder="Notification title"
        value={notification.title || ""}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as any).title = e.target.value.slice(0, 100);
          })
        }
      />
      <textarea
        className="soft-input min-h-[70px] resize-none"
        placeholder="Notification message"
        value={notification.body || ""}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as any).body = e.target.value.slice(0, 200);
          })
        }
      />

      {showSoundControls && (
        <div className="flex gap-2 items-center min-w-0">
          <select
            className="soft-input max-w-[80px]"
            value={soundType}
            onChange={(e) => {
              const newSoundType = e.target.value as
                | "default"
                | "url"
                | "upload"
                | "custom";
              mutateBlock(block.id, (prev) => {
                (prev as any).soundType =
                  newSoundType === "url" || newSoundType === "custom"
                    ? "custom"
                    : newSoundType;
              });
            }}
          >
            <option value="default">Default</option>
            <option value="custom">Custom URL</option>
            <option value="upload">Upload file</option>
          </select>
          {soundType === "default" && (
            <select
              className="soft-input flex-1"
              value={notification.label || "Beep"}
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).label = e.target.value;
                })
              }
            >
              <option value="Beep">Beep</option>
            </select>
          )}
          {soundType === "custom" && (
            <input
              type="text"
              className="soft-input flex-1"
              placeholder="https://example.com/sound.mp3"
              value={notification.customUrl || ""}
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).customUrl = e.target.value;
                })
              }
            />
          )}
          {soundType === "upload" && (
            <AudioDropWrapper
              onFile={async (file) => {
                const url = await fileToDataUrl(file);
                if (!url) return;
                mutateBlock(block.id, (prev) => {
                  (prev as any).customUrl = url;
                  (prev as any).soundType = "upload";
                });
              }}
              className="border-2 border-dashed border-accent-200 rounded-lg p-4 text-center cursor-pointer hover:bg-accent-50-20 transition-colors flex-1"
              disabled={!!draggingBlockId}
            >
              <p className="text-xs text-accent-400">
                Drag audio file or click to select
              </p>
            </AudioDropWrapper>
          )}
        </div>
      )}

      {showTimeoutControls && (
        <div className="flex gap-2 flex-wrap">
          <div className="flex flex-col gap-1 items-center">
            <label className="text-[11px] text-accent-400">Timeout (s)</label>
            <input
              type="number"
              min={1}
              step={1}
              className="soft-input max-w-[80px]"
              value={Math.round((notification.timeoutMs ?? 10000) / 1000)}
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).timeoutMs =
                    Math.max(1000, Number(e.target.value) || 10) * 1000;
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1 items-center">
            <label className="text-[11px] text-accent-400">Interval (s)</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              className="soft-input max-w-[70px]"
              value={notification.interval ?? 0.5}
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).interval = Math.max(
                    0.1,
                    Number(e.target.value) || 0.5
                  );
                })
              }
            />
          </div>
        </div>
      )}
    </>
  );
};

interface WaitBlockUIProps {
  block: WaitBlock;
  mutateBlock: BlockMutator;
}

export const WaitBlockUI: React.FC<WaitBlockUIProps> = ({ block, mutateBlock }) => (
  <div className="flex gap-2 items-center mt-2">
    <input
      type="number"
      min={0}
      className="soft-input max-w-[80px]"
      value={block.amount}
      onChange={(e) =>
        mutateBlock(block.id, (prev) => {
          (prev as WaitBlock).amount = Number(e.target.value);
        })
      }
    />
    <select
      className="soft-input"
      value={block.unit}
      onChange={(e) =>
        mutateBlock(block.id, (prev) => {
          (prev as WaitBlock).unit = e.target.value as WaitBlock["unit"];
        })
      }
    >
      {TIME_UNITS.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  </div>
);

interface WaitUntilBlockUIProps {
  block: WaitUntilBlock;
  mutateBlock: BlockMutator;
}

export const WaitUntilBlockUI: React.FC<WaitUntilBlockUIProps> = ({ block, mutateBlock }) => {
  const safe = sanitizeTimeInput(block.time, "07:00");
  const [hh, mm] = safe.split(":");
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  return (
    <div className="flex gap-2 items-center mt-2">
      <select
        className="soft-input max-w-[90px]"
        value={hh}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as WaitUntilBlock).time = `${e.target.value}:${mm}`;
          })
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
          mutateBlock(block.id, (prev) => {
            (prev as WaitUntilBlock).time = `${hh}:${e.target.value}`;
          })
        }
      >
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        className="soft-input max-w-[70px]"
        value={block.ampm}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as WaitUntilBlock).ampm = e.target.value as any;
          })
        }
      >
        <option>AM</option>
        <option>PM</option>
      </select>
    </div>
  );
};

interface PlaySoundBlockUIProps {
  block: PlaySoundBlock;
  mutateBlock: BlockMutator;
  draggingBlockId: string | null;
}

export const PlaySoundBlockUI: React.FC<PlaySoundBlockUIProps> = ({
  block,
  mutateBlock,
  draggingBlockId
}) => {
  const fileToDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : undefined);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });

  const soundType = block.soundType === "custom" ? "url" : block.soundType ?? "default";

  const handleFileSelect = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl) return;
    mutateBlock(block.id, (prev) => {
      const target = prev as PlaySoundBlock;
      target.customUrl = dataUrl;
      target.label = file.name || target.label;
      target.soundType = "upload";
    });
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2 items-center min-w-0">
        <select
          className="soft-input max-w-[80px]"
          value={soundType}
          onChange={(e) =>
            mutateBlock(block.id, (prev) => {
              (prev as PlaySoundBlock).soundType = e.target
                .value as PlaySoundBlock["soundType"];
            })
          }
        >
          <option value="default">Default</option>
          <option value="url">URL</option>
          <option value="upload">Upload</option>
        </select>
        {soundType === "default" && (
          <select
            className="soft-input flex-1"
            value={block.label || "Beep"}
            onChange={(e) =>
              mutateBlock(block.id, (prev) => {
                (prev as PlaySoundBlock).label = e.target.value;
              })
            }
          >
            <option value="Beep">Beep</option>
          </select>
        )}
        {soundType === "url" && (
          <input
            className="soft-input flex-1"
            placeholder="https://example.com/audio.mp3"
            value={block.customUrl || ""}
            onChange={(e) =>
              mutateBlock(block.id, (prev) => {
                (prev as PlaySoundBlock).customUrl = e.target.value;
              })
            }
          />
        )}
        {soundType === "upload" && (
          <AudioDropWrapper
            onFile={handleFileSelect}
            className="soft-input flex-1 border-dashed cursor-pointer text-sm text-accent-500"
            disabled={!!draggingBlockId}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-accent-500 truncate">
                {block.customUrl
                  ? block.label || "Audio file loaded"
                  : "Upload or drag a sound file"}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-accent-400">
                Choose File
              </span>
            </div>
          </AudioDropWrapper>
        )}
      </div>
    </div>
  );
};

interface PlaySoundUntilBlockUIProps {
  block: PlaySoundUntilBlock;
  mutateBlock: BlockMutator;
  draggingBlockId: string | null;
}

export const PlaySoundUntilBlockUI: React.FC<PlaySoundUntilBlockUIProps> = ({
  block,
  mutateBlock,
  draggingBlockId
}) => {
  const fileToDataUrl = (file: File): Promise<string | undefined> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : undefined);
      };
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(file);
    });

  const soundType = block.soundType === "custom" ? "url" : block.soundType ?? "default";

  const handleFileSelect = async (file: File) => {
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl) return;
    mutateBlock(block.id, (prev) => {
      const target = prev as PlaySoundUntilBlock;
      target.customUrl = dataUrl;
      target.label = file.name || target.label;
      target.soundType = "upload";
    });
  };

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2 items-center min-w-0">
        <select
          className="soft-input max-w-[80px]"
          value={soundType}
          onChange={(e) =>
            mutateBlock(block.id, (prev) => {
              (prev as PlaySoundUntilBlock).soundType = e.target
                .value as PlaySoundUntilBlock["soundType"];
            })
          }
        >
          <option value="default">Default</option>
          <option value="url">URL</option>
          <option value="upload">Upload</option>
        </select>
        {soundType === "default" && (
          <select
            className="soft-input flex-1"
            value={block.label || "Beep"}
            onChange={(e) =>
              mutateBlock(block.id, (prev) => {
                (prev as PlaySoundUntilBlock).label = e.target.value;
              })
            }
          >
            <option value="Beep">Beep</option>
          </select>
        )}
        {soundType === "url" && (
          <input
            className="soft-input flex-1"
            placeholder="https://example.com/audio.mp3"
            value={block.customUrl || ""}
            onChange={(e) =>
              mutateBlock(block.id, (prev) => {
                (prev as PlaySoundUntilBlock).customUrl = e.target.value;
              })
            }
          />
        )}
        {soundType === "upload" && (
          <AudioDropWrapper
            onFile={handleFileSelect}
            className="soft-input flex-1 border-dashed cursor-pointer text-sm text-accent-500"
            disabled={!!draggingBlockId}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-accent-500 truncate">
                {block.customUrl
                  ? block.label || "Audio file loaded"
                  : "Upload or drag a sound file"}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-accent-400">
                Choose File
              </span>
            </div>
          </AudioDropWrapper>
        )}
      </div>

      <p className="text-[11px] text-accent-400 mt-1">
        Plays once and continues after the sound finishes.
      </p>
    </div>
  );
};
