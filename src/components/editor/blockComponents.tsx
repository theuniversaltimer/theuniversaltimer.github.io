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
  const soundType =
    notification.soundType === "custom" ? "url" : notification.soundType ?? "default";

  const handleFileSelect = async (file: File) => {
    const url = await fileToDataUrl(file);
    if (!url) return;
    mutateBlock(block.id, (prev) => {
      (prev as any).customUrl = url;
      (prev as any).soundType = "upload";
      (prev as any).label = file.name || (prev as any).label;
    });
  };

  return (
    <>
      <input
        className="soft-input w-full"
        placeholder="Notification title"
        value={notification.title || ""}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as any).title = e.target.value.slice(0, 100);
          })
        }
      />
      <textarea
        className="soft-input min-h-[70px] resize-none w-full"
        placeholder="Notification message"
        value={notification.body || ""}
        onChange={(e) =>
          mutateBlock(block.id, (prev) => {
            (prev as any).body = e.target.value.slice(0, 200);
          })
        }
      />

      {showSoundControls && (
        <div className="flex items-center gap-2 flex-nowrap flex-1 min-w-0">
          <select
            className="soft-input shrink-0"
            value={soundType}
            data-no-drag
            onChange={(e) => {
              const newSoundType = e.target.value as "default" | "url" | "upload";
              mutateBlock(block.id, (prev) => {
                (prev as any).soundType = newSoundType;
                if (newSoundType === "default") {
                  (prev as any).customUrl = "";
                  (prev as any).label = (prev as any).label || "Beep";
                }
              });
            }}
          >
            <option value="default">Default</option>
            <option value="url">URL</option>
            <option value="upload">Upload</option>
          </select>

          {soundType === "default" && (
            <select
              className="soft-input sound-default-select"
              value={notification.label || "Beep"}
              data-no-drag
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).label = e.target.value;
                })
              }
            >
              <option value="Beep">Beep</option>
            </select>
          )}
          {soundType === "url" && (
            <input
              type="text"
              className="soft-text-input min-w-0"
              placeholder="https://example.com/audio.mp3"
              value={notification.customUrl || ""}
              data-no-drag
              onChange={(e) =>
                mutateBlock(block.id, (prev) => {
                  (prev as any).customUrl = e.target.value;
                })
              }
            />
          )}
          {soundType === "upload" && (
            <AudioDropWrapper
              onFile={handleFileSelect}
              className="soft-text-input upload-input flex items-center min-w-0 cursor-pointer"
              disabled={!!draggingBlockId}
            >
              <span className="truncate text-sm text-accent-500 w-full text-left">
                {notification.customUrl
                  ? notification.label || "Audio file loaded"
                  : "Upload or drag a sound file"}
              </span>
            </AudioDropWrapper>
          )}
        </div>
      )}

      {/* Timeout/interval fields intentionally omitted per design request */}
    </>
  );
};

interface WaitBlockUIProps {
  block: WaitBlock;
  mutateBlock: BlockMutator;
}

export const WaitBlockUI: React.FC<WaitBlockUIProps> = ({ block, mutateBlock }) => (
  <div className="flex items-center gap-2 flex-nowrap">
    <input
      type="number"
      min={0}
      step={block.unit === "minutes" ? 5 : 1}
      className="soft-input wait-number"
      value={block.amount}
      data-no-drag
      onChange={(e) =>
        mutateBlock(block.id, (prev) => {
          (prev as WaitBlock).amount = Number(e.target.value);
        })
      }
    />
    <select
      className="soft-input wait-unit"
      value={block.unit}
      data-no-drag
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
    <div className="flex items-center gap-2 flex-nowrap">
      <select
        className="soft-input wait-time"
        value={hh}
        data-no-drag
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
      <select
        className="soft-input wait-time"
        value={mm}
        data-no-drag
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
        className="soft-input wait-ampm"
        value={block.ampm}
        data-no-drag
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
    <div className="flex items-center gap-2 flex-nowrap flex-1 min-w-0">
      <select
        className="soft-input shrink-0"
        value={soundType}
        data-no-drag
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
          className="soft-input sound-default-select"
          value={block.label || "Beep"}
          data-no-drag
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
          className="soft-text-input min-w-0"
          placeholder="https://example.com/audio.mp3"
          value={block.customUrl || ""}
          data-no-drag
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
          className="soft-text-input upload-input flex items-center min-w-0 cursor-pointer"
          disabled={!!draggingBlockId}
        >
          <span className="truncate text-sm text-accent-500 w-full text-left">
            {block.customUrl
              ? block.label || "Audio file loaded"
              : "Upload or drag a sound file"}
          </span>
        </AudioDropWrapper>
      )}
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
    <div className="flex items-center gap-2 flex-nowrap flex-1 min-w-0">
      <select
        className="soft-input shrink-0"
        value={soundType}
        data-no-drag
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
          className="soft-input sound-default-select"
          value={block.label || "Beep"}
          data-no-drag
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
          className="soft-text-input min-w-0"
          placeholder="https://example.com/audio.mp3"
          value={block.customUrl || ""}
          data-no-drag
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
          className="soft-text-input upload-input flex items-center min-w-0 cursor-pointer"
          disabled={!!draggingBlockId}
        >
          <span className="truncate text-sm text-accent-500 w-full text-left">
            {block.customUrl
              ? block.label || "Audio file loaded"
              : "Upload or drag a sound file"}
          </span>
        </AudioDropWrapper>
      )}
    </div>
  );
};
