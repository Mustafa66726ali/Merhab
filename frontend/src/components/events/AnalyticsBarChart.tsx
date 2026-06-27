"use client";

import { motion } from "framer-motion";
import type { EventChartSeries } from "@/lib/api";

interface AnalyticsBarChartProps {
  title: string;
  subtitle?: string;
  data: EventChartSeries;
  color?: "primary" | "tertiary";
}

export default function AnalyticsBarChart({
  title,
  subtitle,
  data,
  color = "primary",
}: AnalyticsBarChartProps) {
  const isPrimary = color === "primary";

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[60px] ${
          isPrimary ? "bg-primary-container/15" : "bg-tertiary/15"
        }`}
      />
      <div className="relative mb-6">
        <h4 className="text-base font-bold text-on-surface sm:text-lg">{title}</h4>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto pb-1">
        <div
          className={`flex items-end justify-between gap-1 sm:gap-2 h-[160px] sm:h-[180px] ${
            data.labels.length > 8 ? "min-w-[520px]" : ""
          }`}
        >
          {data.labels.map((label, i) => (
            <div key={`${label}-${i}`} className="flex flex-1 flex-col items-center gap-2 h-full min-w-0 group">
              <div className="relative flex-1 w-full rounded-t-lg bg-surface-container-high/40 overflow-hidden">
                <motion.div
                  className={`absolute bottom-0 w-full rounded-t-lg ${
                    isPrimary
                      ? "bg-gradient-to-t from-primary-container to-primary/80 group-hover:shadow-[0_0_16px_rgba(91,46,255,0.4)]"
                      : "bg-gradient-to-t from-tertiary-container to-tertiary/80 group-hover:shadow-[0_0_16px_rgba(255,181,155,0.35)]"
                  }`}
                  initial={{ height: 0 }}
                  animate={{ height: data.heights[i] || "5%" }}
                  transition={{ delay: i * 0.03, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  title={`${data.values[i]}`}
                />
              </div>
              <span className="text-[8px] sm:text-[9px] font-bold text-on-surface-variant truncate w-full text-center group-hover:text-on-surface transition-colors">
                {label}
              </span>
              <span className="text-[9px] font-bold text-outline tabular-nums">{data.values[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
