import React from "react";
import { motion } from "framer-motion";
import type { ThemeName } from "../types";
import { ThemeSwatch } from "./ThemeSwatch";

const themeOptions: { id: ThemeName; label: string; swatch: string }[] = [
  { id: "white", label: "White", swatch: "#ffffff" },
  { id: "green", label: "Mint green", swatch: "#bbf7d0" },
  { id: "blue", label: "Sky blue", swatch: "#bae6fd" },
  { id: "yellow", label: "Butter yellow", swatch: "#fef08a" },
  { id: "purple", label: "Lavender", swatch: "#ddd6fe" },
  { id: "pink", label: "Blush pink", swatch: "#fecdd3" },
  { id: "dark", label: "Dark", swatch: "#202024" }
];

interface Props {
  theme: ThemeName;
  onChange: (theme: ThemeName) => void;
}

const ThemeBar: React.FC<Props> = ({ theme, onChange }) => {
  return (
    <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2">
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0.12}
        whileTap={{ scale: 0.97 }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target && target.closest("button")) {
            e.stopPropagation();
          }
        }}
        className="theme-bar flex items-center gap-2 rounded-full border px-3 py-2 cursor-grab active:cursor-grabbing select-none"
      >
        {themeOptions.map((option) => (
          <ThemeSwatch
            key={option.id}
            color={option.swatch}
            label={option.label}
            isActive={option.id === theme}
            onClick={() => onChange(option.id)}
          />
        ))}
      </motion.div>
    </div>
  );
};

export default ThemeBar;
