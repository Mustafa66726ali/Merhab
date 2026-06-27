"use client";

import { motion } from "framer-motion";

interface ResourceGaugeProps {
  label: string;
  percent: number;
  detail?: string;
  color?: "primary" | "tertiary" | "emerald" | "amber";
  icon: string;
}

const colorMap = {
  primary: {
    ring: "stroke-primary-container",
    glow: "shadow-primary-container/30",
    text: "text-primary",
    bg: "bg-primary-container/15",
  },
  tertiary: {
    ring: "stroke-tertiary",
    glow: "shadow-tertiary/30",
    text: "text-tertiary",
    bg: "bg-tertiary/15",
  },
  emerald: {
    ring: "stroke-emerald-400",
    glow: "shadow-emerald-500/30",
    text: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  amber: {
    ring: "stroke-amber-400",
    glow: "shadow-amber-500/30",
    text: "text-amber-400",
    bg: "bg-amber-500/15",
  },
};

export default function ResourceGauge({
  label,
  percent,
  detail,
  color = "primary",
  icon,
}: ResourceGaugeProps) {
  const c = colorMap[color];
  const clamped = Math.min(Math.max(percent, 0), 100);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/10 blur-[40px] rounded-full -mr-8 -mt-8" />
      <div className="flex flex-col items-center relative z-10">
        <div className={`relative w-28 h-28 sm:w-32 sm:h-32 mb-3 rounded-full ${c.bg} flex items-center justify-center`}>
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-surface-container-high"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={c.ring}
              stroke="currentColor"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              strokeDasharray={circumference}
            />
          </svg>
          <div className="text-center">
            <span className={`material-symbols-outlined text-lg ${c.text} mb-0.5 block`}>{icon}</span>
            <span className={`text-xl sm:text-2xl font-extrabold font-headline tabular-nums ${c.text}`}>
              {clamped}%
            </span>
          </div>
        </div>
        <p className="text-sm font-bold text-on-surface">{label}</p>
        {detail && <p className="text-[10px] text-on-surface-variant mt-0.5 text-center">{detail}</p>}
      </div>
    </div>
  );
}
