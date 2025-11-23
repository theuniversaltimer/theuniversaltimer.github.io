import {
  Block,
  BlockType,
  LoopBlock
} from "../../types";
import { createId } from "../../utils/ids";

export type InsertPosition = "before" | "after" | "inside";

export type DropDescriptor =
  | { kind: "root"; position: "prepend" | "append" }
  | { kind: "root-empty" }
  | { kind: "block"; targetId: string; position: InsertPosition };

export type DragMeta =
  | { kind: "palette"; blockType: BlockType }
  | { kind: "existing"; blockId: string };

export const buildDropId = (target: string, position: string) =>
  `drop:${target}:${position}`;

const cloneBlock = (block: Block): Block => {
  if (block.type === "loop") {
    return {
      ...(block as LoopBlock),
      children: (block as LoopBlock).children.map(cloneBlock)
    };
  }
  return { ...block };
};

const cloneBlocks = (blocks: Block[]): Block[] => blocks.map(cloneBlock);

export const parseDropId = (id: string): DropDescriptor | null => {
  const [prefix, target, position] = id.split(":");
  if (prefix !== "drop" || !target || !position) return null;
  if (target === "root") {
    if (position === "empty") return { kind: "root-empty" };
    if (position === "prepend" || position === "append") {
      return { kind: "root", position };
    }
    return null;
  }
  if (
    position === "before" ||
    position === "after" ||
    position === "inside"
  ) {
    return { kind: "block", targetId: target, position };
  }
  return null;
};

export const createDefaultBlock = (type: BlockType): Block => {
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
        label: "Beep"
      };
    case "playSoundUntil":
      return {
        id: createId(),
        type: "playSoundUntil",
        soundType: "default",
        label: "Beep"
      } as Block;
    case "notify":
      return {
        id: createId(),
        type: "notify",
        title: "Reminder",
        body: "Your timer is running."
      };
    case "notifyUntil":
      return {
        id: createId(),
        type: "notifyUntil",
        title: "Reminder",
        body: "Your timer is running.",
        label: "Beep",
        timeoutMs: 10000,
        soundType: "default",
        interval: 0.3
      } as Block;
    case "loop":
    default:
      return {
        id: createId(),
        type: "loop",
        repeat: 2,
        children: []
      } as Block;
  }
};

export const updateBlockTree = (
  blocks: Block[],
  id: string,
  updater: (b: Block) => Block
): Block[] => {
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
};

export const deleteBlockTree = (blocks: Block[], id: string): Block[] => {
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
};

export const findBlockById = (blocks: Block[], id: string): Block | null => {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.type === "loop") {
      const found = findBlockById((b as LoopBlock).children, id);
      if (found) return found;
    }
  }
  return null;
};

export const findAndRemove = (
  blocks: Block[],
  id: string
): { found: Block | null; without: Block[] } => {
  let found: Block | null = null;
  const without: Block[] = [];

  for (const b of blocks) {
    if (b.id === id) {
      found = b;
      continue;
    }
    if (b.type === "loop") {
      const result = findAndRemove((b as LoopBlock).children, id);
      if (result.found && !found) {
        found = result.found;
      }
      without.push({
        ...(b as LoopBlock),
        children: result.without
      });
    } else {
      without.push(b);
    }
  }

  return { found, without };
};

const blockContainsId = (block: Block, id: string): boolean => {
  if (block.type !== "loop") return false;
  for (const child of (block as LoopBlock).children) {
    if (child.id === id) return true;
    if (child.type === "loop" && blockContainsId(child, id)) {
      return true;
    }
  }
  return false;
};

const insertRelative = (
  blocks: Block[],
  targetId: string,
  newBlock: Block,
  position: InsertPosition
): Block[] => {
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
};

export const moveBlock = (
  blocks: Block[],
  movingId: string,
  targetId: string,
  position: InsertPosition
): Block[] => {
  if (movingId === targetId) return blocks;

  const targetBlock = findBlockById(blocks, targetId);
  if (!targetBlock) return blocks;

  const { found: movingBlock, without } = findAndRemove(blocks, movingId);
  if (!movingBlock) return blocks;

  if (movingBlock.type === "loop" && blockContainsId(movingBlock, targetId)) {
    return blocks;
  }

  return insertRelative(without, targetId, cloneBlock(movingBlock), position);
};

export const applyPaletteDrop = (
  blocks: Block[],
  block: Block,
  drop: DropDescriptor
): Block[] => {
  const safeBlocks = cloneBlocks(blocks);
  if (drop.kind === "root-empty") {
    return [...safeBlocks, block];
  }
  if (drop.kind === "root") {
    return drop.position === "prepend" ? [block, ...safeBlocks] : [...safeBlocks, block];
  }
  if (drop.kind === "block") {
    return insertRelative(safeBlocks, drop.targetId, block, drop.position);
  }
  return safeBlocks;
};

export const applyExistingDrop = (
  blocks: Block[],
  blockId: string,
  drop: DropDescriptor
): Block[] => {
  const safeBlocks = cloneBlocks(blocks);
  
  if (drop.kind === "block") {
    return moveBlock(safeBlocks, blockId, drop.targetId, drop.position);
  }

  const { found: movingBlock, without } = findAndRemove(safeBlocks, blockId);
  if (!movingBlock) return safeBlocks;
  
  const clonedMoving = cloneBlock(movingBlock);

  if (drop.kind === "root-empty") {
    return [...without, clonedMoving];
  }

  if (drop.kind === "root") {
    return drop.position === "prepend"
      ? [clonedMoving, ...without]
      : [...without, clonedMoving];
  }

  return safeBlocks;
};
