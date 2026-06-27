"use client";

import type { ReactNode } from "react";
import type { EventScheduleItem } from "@/lib/api";
import {
  formatDurationMinutes,
  formatScheduleClock,
  isGeneralLocation,
  locationLabel,
  scheduleDurationMinutes,
} from "./scheduleUtils";

interface ScheduleTimelineItemProps {
  item: EventScheduleItem;
  index: number;
  isLast: boolean;
  isActive: boolean;
  canManage: boolean;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children?: ReactNode;
}

export default function ScheduleTimelineItem({
  item,
  index,
  isLast,
  isActive,
  canManage,
  deleting,
  onEdit,
  onDelete,
  children,
}: ScheduleTimelineItemProps) {
  const duration = scheduleDurationMinutes(item);

  return (
    <article className="relative flex flex-col sm:flex-row gap-3 sm:gap-8 lg:gap-12 group">
      {/* Mobile time strip */}
      <div className="sm:hidden flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">schedule</span>
          <span className="text-base font-bold text-primary tabular-nums">
            {formatScheduleClock(item.start_time)}
          </span>
          <span className="text-xs text-outline">→ {formatScheduleClock(item.end_time)}</span>
        </div>
        <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded-lg">
          {formatDurationMinutes(duration)}
        </span>
      </div>

      {/* Desktop time column */}
      <div className="hidden sm:block w-20 lg:w-24 pt-3 text-right shrink-0">
        <span
          className={`text-lg lg:text-xl font-bold block tabular-nums ${
            isActive ? "text-primary" : "text-on-surface"
          }`}
        >
          {formatScheduleClock(item.start_time)}
        </span>
        <span className="text-[10px] text-on-surface-variant/70 mt-1 block leading-tight">
          {formatScheduleClock(item.end_time)}
        </span>
      </div>

      {/* Timeline node */}
      <div className="hidden sm:flex relative z-10 shrink-0 mt-3 flex-col items-center">
        <div
          className={`w-8 h-8 lg:w-9 lg:h-9 rounded-full flex items-center justify-center transition-all ${
            isActive
              ? "bg-primary shadow-lg shadow-primary/30 scale-110"
              : index === 0
                ? "bg-surface-container-highest border-2 border-primary-container shadow-lg shadow-primary-container/20"
                : "bg-surface-container-highest border-2 border-outline-variant/60"
          }`}
        >
          {isActive ? (
            <span
              className="material-symbols-outlined text-on-primary text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              edit
            </span>
          ) : (
            <div
              className={`w-2 h-2 rounded-full ${
                index === 0 ? "bg-primary" : "bg-outline-variant"
              }`}
            />
          )}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 min-h-[2rem] mt-2 bg-gradient-to-b from-outline-variant/60 to-outline-variant/20"
            aria-hidden
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-2 sm:pb-6">
        {children ?? (
          <div
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm p-4 sm:p-6 hover:border-primary/35 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-on-surface leading-snug">
                {item.title}
              </h3>
              <span className="self-start bg-primary-container/15 text-primary px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold shrink-0">
                {locationLabel(item.location)}
              </span>
            </div>

            {item.description && (
              <p className="text-on-surface-variant leading-relaxed text-sm mb-4">
                {item.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-outline">
              <span className="hidden sm:flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">timer</span>
                {formatDurationMinutes(duration)}
              </span>
              {!isGeneralLocation(item.location) && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  {item.location}
                </span>
              )}
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-outline-variant/10">
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  {deleting ? "جاري الحذف..." : "حذف"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
