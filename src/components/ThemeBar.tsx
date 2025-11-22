import React, { useEffect, useRef, useState } from "react";
import type { ThemeName } from "../types";

const themeOptions: { id: ThemeName; label: string; swatch: string }[] = [
  { id: "green", label: "Mint green", swatch: "#bbf7d0" },
  { id: "blue", label: "Sky blue", swatch: "#bae6fd" },
  { id: "yellow", label: "Butter yellow", swatch: "#fef08a" },
  { id: "purple", label: "Lavender", swatch: "#ddd6fe" },
  { id: "pink", label: "Blush pink", swatch: "#fecdd3" }
];

interface Props {
  theme: ThemeName;
  onChange: (theme: ThemeName) => void;
}

const ThemeBar: React.FC<Props> = ({ theme, onChange }) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const startRef = useRef({ x: 0, y: 0 });
  const originRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      setPosition({
        x: originRef.current.x + dx,
        y: originRef.current.y + dy
      });
    };

    const handlePointerUp = () => {
      if (dragging) {
        setDragging(false);
      }
    };

    if (dragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging]);

  const startDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button")) {
      return;
    }
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY };
    originRef.current = { ...position };
    setDragging(true);
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 z-30"
      style={{
        transform: `translate(calc(-50% + ${position.x}px), ${position.y}px) scale(0.95)`
      }}
    >
      <div
        className="flex items-center gap-2 rounded-full bg-white/90 border border-accent-100 px-3 py-2 shadow-accent-soft cursor-grab active:cursor-grabbing select-none"
        onPointerDown={startDrag}
      >
        {themeOptions.map((option) => {
          const isActive = option.id === theme;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-label={`Switch to ${option.label}`}
              className={`h-9 w-9 rounded-full border-2 transition duration-200 ease-out focus:outline-none ${
                isActive ? "scale-110" : "hover:scale-105"
              }`}
              style={{
                backgroundColor: option.swatch,
                borderColor: isActive
                  ? `rgb(var(--accent-400))`
                  : "rgba(0,0,0,0.05)",
                boxShadow: isActive
                  ? "0 0 0 4px rgba(255,255,255,0.8), 0 10px 18px rgba(0,0,0,0.12)"
                  : "0 6px 14px rgba(0,0,0,0.08)"
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ThemeBar;
