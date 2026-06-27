"use client";

import { useMemo, useState } from "react";
import type { ActivityHeatmapData } from "@/lib/api";

interface ActivityHeatmapProps {
  title: string;
  subtitle?: string;
  data: ActivityHeatmapData;
}

function cellColor(value: number, max: number): string {
  if (value <= 0) return "rgba(71, 69, 87, 0.12)";
  const ratio = value / max;
  if (ratio <= 0.2) return "rgba(91, 46, 255, 0.22)";
  if (ratio <= 0.4) return "rgba(91, 46, 255, 0.42)";
  if (ratio <= 0.6) return "rgba(91, 46, 255, 0.62)";
  if (ratio <= 0.8) return "rgba(91, 46, 255, 0.82)";
  return "rgba(91, 46, 255, 1)";
}

export default function ActivityHeatmap({ title, subtitle, data }: ActivityHeatmapProps) {
  const [hover, setHover] = useState<{
    day: string;
    hour: string;
    value: number;
  } | null>(null);

  const peakCell = useMemo(() => {
    let best = { day: "", hour: "", value: 0 };
    data.matrix.forEach((row, di) => {
      row.forEach((val, hi) => {
        if (val > best.value) {
          best = {
            day: data.day_labels[di],
            hour: data.hour_labels[hi],
            value: val,
          };
        }
      });
    });
    return best;
  }, [data]);

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full blur-[60px] bg-tertiary/10" />

      <div className="relative mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h4 className="text-base font-bold text-on-surface sm:text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">grid_view</span>
            {title}
          </h4>
          {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
        </div>
        {peakCell.value > 0 && (
          <div className="rounded-xl border border-primary-container/25 bg-primary-container/10 px-3 py-2 text-xs shrink-0">
            <span className="text-outline">ذروة النشاط: </span>
            <span className="font-bold text-primary">
              {peakCell.day} · {peakCell.hour}
            </span>
            <span className="text-on-surface-variant"> ({peakCell.value})</span>
          </div>
        )}
      </div>

      {hover && (
        <div className="mb-3 rounded-lg border border-primary-container/30 bg-primary-container/10 px-3 py-2 text-xs text-on-surface">
          <span className="font-bold text-primary">{hover.day}</span>
          <span className="text-on-surface-variant"> — {hover.hour}</span>
          <span className="tabular-nums font-bold"> · {hover.value} فعالية</span>
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[320px]">
          {/* Hour headers */}
          <div className="flex gap-1 mb-1 pl-12 sm:pl-14">
            {data.hour_labels.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[8px] sm:text-[9px] font-bold text-outline tabular-nums"
                dir="ltr"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {data.matrix.map((row, dayIdx) => (
            <div key={data.day_labels[dayIdx]} className="flex items-center gap-1 mb-1">
              <span className="w-11 sm:w-14 text-[9px] sm:text-[10px] font-bold text-on-surface-variant truncate shrink-0">
                {data.day_labels[dayIdx]}
              </span>
              <div className="flex flex-1 gap-1">
                {row.map((value, hourIdx) => (
                  <button
                    key={`${dayIdx}-${hourIdx}`}
                    type="button"
                    className="flex-1 aspect-square min-w-[28px] max-w-[48px] rounded-md sm:rounded-lg border border-outline-variant/10 transition-all hover:scale-105 hover:border-primary-container/50 focus:outline-none focus:ring-2 focus:ring-primary-container/40"
                    style={{ backgroundColor: cellColor(value, data.max) }}
                    title={`${data.day_labels[dayIdx]} ${data.hour_labels[hourIdx]}: ${value}`}
                    onMouseEnter={() =>
                      setHover({
                        day: data.day_labels[dayIdx],
                        hour: data.hour_labels[hourIdx],
                        value,
                      })
                    }
                    onMouseLeave={() => setHover(null)}
                    onFocus={() =>
                      setHover({
                        day: data.day_labels[dayIdx],
                        hour: data.hour_labels[hourIdx],
                        value,
                      })
                    }
                    onBlur={() => setHover(null)}
                    aria-label={`${data.day_labels[dayIdx]} ${data.hour_labels[hourIdx]}: ${value} فعالية`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/10 pt-4">
        <span className="text-[10px] text-outline font-bold">شدة النشاط</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-outline">منخفض</span>
          {[0.12, 0.22, 0.42, 0.62, 0.82, 1].map((level) => (
            <div
              key={level}
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md border border-outline-variant/10"
              style={{
                backgroundColor:
                  level === 0.12
                    ? "rgba(71, 69, 87, 0.12)"
                    : `rgba(91, 46, 255, ${level})`,
              }}
            />
          ))}
          <span className="text-[9px] text-outline">عالي</span>
        </div>
      </div>
    </div>
  );
}
