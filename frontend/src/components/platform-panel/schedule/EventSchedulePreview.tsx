"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { EventDetail, EventScheduleItem } from "@/lib/api";
import {
  formatDurationMinutes,
  formatScheduleClock,
  locationLabel,
  scheduleDurationMinutes,
} from "./scheduleUtils";

interface EventSchedulePreviewProps {
  event: EventDetail;
  eventsBasePath: string;
  maxItems?: number;
}

export default function EventSchedulePreview({
  event,
  eventsBasePath,
  maxItems = 3,
}: EventSchedulePreviewProps) {
  const scheduleHref = `${eventsBasePath}/${event.id}/schedule`;
  const schedules = [...(event.schedules ?? [])].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );
  const preview = schedules.slice(0, maxItems);
  const totalMinutes = schedules.reduce(
    (sum, s) => sum + scheduleDurationMinutes(s),
    0
  );

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-5 sm:mb-6">
        <div>
          <h4 className="text-lg sm:text-xl font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">schedule</span>
            الجدول الزمني
          </h4>
          <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
            {schedules.length} نشاط · {formatDurationMinutes(totalMinutes)} مخططة
          </p>
        </div>
        <Link
          href={scheduleHref}
          className="shrink-0 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
        >
          عرض الكامل
          <span className="material-symbols-outlined text-base">chevron_left</span>
        </Link>
      </div>

      {schedules.length === 0 ? (
        <div className="text-center py-8 rounded-xl bg-surface-container-high/40 border border-dashed border-outline-variant/20">
          <span className="material-symbols-outlined text-4xl text-outline/50 mb-2">event_upcoming</span>
          <p className="text-sm text-on-surface-variant">لا توجد أنشطة في الجدول بعد</p>
          <Link
            href={scheduleHref}
            className="mt-3 inline-flex text-sm font-bold text-primary hover:underline"
          >
            إنشاء الجدول الزمني
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {preview.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-high/50 border border-outline-variant/10 hover:border-primary/25 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary tabular-nums">
                  {formatScheduleClock(item.start_time)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-on-surface text-sm truncate">{item.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {locationLabel(item.location)} · {formatDurationMinutes(scheduleDurationMinutes(item))}
                </p>
              </div>
            </li>
          ))}
          {schedules.length > maxItems && (
            <p className="text-xs text-center text-on-surface-variant pt-1">
              +{schedules.length - maxItems} أنشطة إضافية
            </p>
          )}
        </ul>
      )}
    </div>
  );
}
