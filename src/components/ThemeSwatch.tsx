import React from "react";

interface ThemeSwatchProps {
  color: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const ThemeSwatch: React.FC<ThemeSwatchProps> = ({
  color,
  label,
  isActive,
  onClick
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Switch to ${label}`}
      className={`h-9 w-9 rounded-full border-2 transition duration-200 ease-out focus:outline-none ${
        isActive ? "scale-110" : "hover:scale-105"
      }`}
      style={{
        backgroundColor: color,
        borderColor: isActive
          ? `rgb(var(--accent-400))`
          : "rgba(0,0,0,0.05)",
        boxShadow: isActive
          ? "0 0 0 4px rgba(255,255,255,0.8), 0 10px 18px rgba(0,0,0,0.12)"
          : "0 6px 14px rgba(0,0,0,0.08)"
      }}
    />
  );
};
