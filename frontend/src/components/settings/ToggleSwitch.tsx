"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  id?: string;
}

const sizeClasses = {
  sm: {
    track: "w-10 h-5",
    thumb: "after:h-4 after:w-4",
  },
  md: {
    track: "w-11 h-6",
    thumb: "after:h-5 after:w-5",
  },
  lg: {
    track: "w-14 h-7",
    thumb: "after:h-6 after:w-6",
  },
};

export default function ToggleSwitch({
  checked,
  onChange,
  disabled,
  size = "md",
  id,
}: ToggleSwitchProps) {
  const s = sizeClasses[size];
  return (
    <label
      className={`relative inline-flex items-center cursor-pointer shrink-0 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
    >
      <input
        id={id}
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`${s.track} bg-surface-container-highest rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full ${s.thumb} after:transition-all peer-checked:bg-primary-container transition-colors`}
      />
    </label>
  );
}
