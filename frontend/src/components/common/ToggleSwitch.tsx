"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}

export default function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
}: ToggleSwitchProps) {
  const dim = size === "sm" ? "w-9 h-5" : "w-11 h-6";
  const knob = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const knobPos = checked
    ? size === "sm"
      ? "right-0.5"
      : "right-0.5"
    : "left-0.5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/50 disabled:opacity-50 ${dim} ${
        checked ? "bg-primary-container" : "bg-outline-variant/40"
      }`}
    >
      <span
        className={`absolute top-0.5 rounded-full bg-white shadow transition-all duration-200 ${knob} ${knobPos}`}
      />
    </button>
  );
}
