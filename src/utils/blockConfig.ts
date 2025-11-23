import type { Block, WaitBlock, WaitUntilBlock, PlaySoundBlock, PlaySoundUntilBlock, NotifyBlock, NotifyUntilBlock } from "../types";

export interface BlockConfig {
  label: string;
  getDescription: (block: Block) => string;
  supportsCountdown?: boolean;
  getCountdownMs?: (block: Block) => number | null;
}

export const BLOCK_CONFIGS: Record<string, BlockConfig> = {
  wait: {
    label: "Wait",
    getDescription: (block) => {
      const wait = block as WaitBlock;
      return `Wait ${wait.amount || 0} ${wait.unit}`;
    },
    supportsCountdown: true,
    getCountdownMs: () => null // Set by runner
  },
  waitUntil: {
    label: "Wait Until",
    getDescription: (block) => {
      const waitUntil = block as WaitUntilBlock;
      return `Wait until ${waitUntil.time || "--:--"} ${waitUntil.ampm}`;
    },
    supportsCountdown: true,
    getCountdownMs: () => null // Set by runner
  },
  playSound: {
    label: "Play Sound",
    getDescription: (block) => {
      const sound = block as PlaySoundBlock;
      return `Play sound – ${sound.label || "Sound"}`;
    }
  },
  playSoundUntil: {
    label: "Play Sound Until",
    getDescription: (block) => {
      const sound = block as PlaySoundUntilBlock;
      return `Play sound (wait) – ${sound.label || "Sound"}`;
    }
  },
  notify: {
    label: "Notify",
    getDescription: (block) => {
      const notification = block as NotifyBlock;
      return `Notify – ${notification.title || "Notification"}`;
    }
  },
  notifyUntil: {
    label: "Notify Until",
    getDescription: (block) => {
      const notifyUntil = block as NotifyUntilBlock;
      return `Notify Until – ${notifyUntil.title || "Notification"}`;
    },
    supportsCountdown: true,
    getCountdownMs: (block) => {
      const notifyUntil = block as NotifyUntilBlock;
      return notifyUntil.timeoutMs ?? 10000;
    }
  },
  loop: {
    label: "Loop",
    getDescription: (block: Block) => {
      const loop = block as any;
      if (loop.repeat === -1) {
        return "Repeat forever";
      }
      return `Repeat ${loop.repeat || 1} ${loop.repeat === 1 ? "time" : "times"}`;
    }
  }
};

export function getBlockConfig(blockType: string): BlockConfig {
  return BLOCK_CONFIGS[blockType] || {
    label: "Unknown",
    getDescription: () => "Unknown block"
  };
}
