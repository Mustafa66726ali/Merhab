"use client";

import { motion } from "framer-motion";

interface MetricHistoryChartProps {
  title: string;
  subtitle?: string;
  labels: string[];
  values: number[];
  unit?: string;
  color?: "primary" | "tertiary";
}

export default function MetricHistoryChart({
  title,
  subtitle,
  labels,
  values,
  unit = "%",
  color = "primary",
}: MetricHistoryChartProps) {
  const max = Math.max(...values, 1);
  const isPrimary = color === "primary";

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 relative overflow-hidden">
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[60px] ${
          isPrimary ? "bg-primary-container/15" : "bg-tertiary/15"
        }`}
      />
      <div className="relative mb-4">
        <h4 className="text-base font-bold text-on-surface sm:text-lg">{title}</h4>
        {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
      </div>
      {values.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">جاري جمع البيانات...</p>
      ) : (
        <div className="flex items-end justify-between gap-1 h-[140px] sm:h-[160px]">
          {values.map((v, i) => (
            <div key={`${labels[i]}-${i}`} className="flex flex-col items-center flex-1 h-full gap-1 min-w-0">
              <span className="text-[9px] font-bold text-outline tabular-nums">
                {v}{unit}
              </span>
              <div className="flex-1 w-full rounded-t-lg bg-surface-container-high/50 overflow-hidden relative">
                <motion.div
                  className={`absolute bottom-0 w-full rounded-t-lg ${
                    isPrimary
                      ? "bg-gradient-to-t from-primary-container to-primary/70"
                      : "bg-gradient-to-t from-tertiary-container to-tertiary/70"
                  }`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max((v / max) * 100, 4)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className="text-[8px] text-on-surface-variant truncate w-full text-center">
                {labels[i]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
