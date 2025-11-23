import React from "react";
import {
  DragOverlay,
  useDraggable,
  useDroppable
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Block, BlockType } from "../../types";
import type { DragMeta } from "./blockTree";
import "./dndPrimitives.css";

export const getBlockLabel = (type: BlockType): string => {
  switch (type) {
    case "wait": return "Wait";
    case "waitUntil": return "Wait Until";
    case "playSound": return "Play Sound";
    case "playSoundUntil": return "Play Sound Until";
    case "notify": return "Notify";
    case "notifyUntil": return "Notify Until";
    case "loop": return "Loop";
    default: return "Block";
  }
};

export const DropZone: React.FC<{
  id: string;
  className?: string;
  activeClassName?: string;
  children?: (isOver: boolean) => React.ReactNode;
}> = ({ id, className = "", activeClassName, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const combinedClass = `${className} ${
    isOver && activeClassName ? activeClassName : ""
  }`.trim();

  return (
    <div ref={setNodeRef} className={combinedClass}>
      {typeof children === "function" ? children(isOver) : children}
    </div>
  );
};

export const DropLine: React.FC = () => <div className="drop-line" />;

export const StandardDropZone: React.FC<{ id: string }> = ({ id }) => (
  <DropZone id={id} className="relative h-8 my-0 transition-all">
    {(isOver) => (isOver ? <DropLine /> : null)}
  </DropZone>
);

export const DraggableCard: React.FC<{
  id: string;
  data: DragMeta;
  children: (args: {
    setNodeRef: (el: HTMLElement | null) => void;
    attributes: ReturnType<typeof useDraggable>["attributes"];
    listeners: ReturnType<typeof useDraggable>["listeners"];
    style: React.CSSProperties;
    isDragging: boolean;
  }) => React.ReactNode;
}> = ({ id, data, children }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data
  });
  const shouldIgnore = (event: Event): boolean => {
    const target = event.target as HTMLElement | null;
    if (!target) return false;
    return Boolean(
      target.closest(
        "input, select, textarea, button, option, [data-no-drag]"
      )
    );
  };
  const filteredListeners = Object.fromEntries(
    Object.entries(listeners || {}).map(([key, handler]) => [
      key,
      (event: any) => {
        if (shouldIgnore(event)) return;
        // @ts-ignore preserving original handler signature
        return handler(event);
      }
    ])
  ) as typeof listeners;
  const style: React.CSSProperties = {
    transform: transform
      ? CSS.Translate.toString({ x: 0, y: transform.y, scaleX: 1, scaleY: 1 })
      : undefined
  };

  return <>{children({ setNodeRef, attributes, listeners: filteredListeners, style, isDragging })}</>;
};

export const PaletteItem: React.FC<{
  blockType: BlockType;
  label: string;
  desc: string;
}> = ({ blockType, label, desc }) => {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `palette:${blockType}`,
    data: { kind: "palette", blockType } as DragMeta
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`pastel-card pastel-hover p-3 cursor-grab select-none transition-opacity ${
        isDragging ? "opacity-75" : ""
      }`}
    >
      <div className="text-sm font-semibold text-accent-600">{label}</div>
      <div className="text-xs text-accent-400">{desc}</div>
    </div>
  );
};

export const BlockOverlay: React.FC<{ block: Block }> = ({ block }) => (
  <div className="pastel-card pastel-hover p-3 min-w-[180px] pointer-events-none select-none">
    <span className="text-xs text-accent-400">{getBlockLabel(block.type)}</span>
  </div>
);

export const EditorDragOverlay: React.FC<{
  block: Block | null;
  renderContent?: (block: Block) => React.ReactNode;
}> = ({ block, renderContent }) => (
  <DragOverlay dropAnimation={null}>
    {block ? (
      <div style={{ width: "100%", pointerEvents: "none" }}>
        {renderContent ? renderContent(block) : <BlockOverlay block={block} />}
      </div>
    ) : null}
  </DragOverlay>
);
