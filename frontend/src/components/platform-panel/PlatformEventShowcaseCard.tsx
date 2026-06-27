"use client";

import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import { eventStatusClass } from "@/components/events/eventStatus";
import type { PlatformEventCard } from "@/lib/api";

function formatEventDate(date: string, time: string) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("ar-SA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return time ? `${dateStr} · ${time}` : dateStr;
  } catch {
    return date;
  }
}

function formatShortDate(date: string) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("ar-SA", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return date;
  }
}

export default function PlatformEventShowcaseCard({
  event,
  rank,
  variant = "top",
  layout = "horizontal",
  eventsBasePath = "/platform/events",
}: {
  event: PlatformEventCard;
  rank?: number;
  variant?: "top" | "bottom";
  layout?: "horizontal" | "compact";
  eventsBasePath?: string;
}) {
  const accent =
    variant === "top"
      ? "from-emerald-500/20 to-primary-container/10 border-emerald-500/20"
      : "from-amber-500/15 to-tertiary/10 border-amber-500/20";

  const location = event.location || event.venue || event.geo_address || "—";
  const detailHref = `${eventsBasePath}/${event.id}`;

  if (layout === "compact") {
    return (
      <Link
        href={detailHref}
        className="group flex flex-col gap-2.5 w-full"
      >
        <div
          className="relative aspect-square w-full overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low group-hover:border-primary-container/35 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-primary-container/10"
        >
          <EventCoverImage
            coverImage={event.cover_image}
            alt=""
            variant="banner"
            className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d18]/80 via-transparent to-[#0d0d18]/20" />

          {rank != null && (
            <span
              className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-[#0d0d18]/85 backdrop-blur text-xs font-extrabold text-on-surface border border-outline-variant/25"
            >
              {rank}
            </span>
          )}

          <span
            className={`absolute top-2.5 left-2.5 px-2 py-0.5 text-[9px] font-bold rounded-full border backdrop-blur-sm ${eventStatusClass(event.status)}`}
          >
            {event.status_label}
          </span>

          <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#0d0d18]/75 backdrop-blur px-2 py-1 text-[10px] font-bold text-on-surface-variant border border-outline-variant/15">
                <span className="material-symbols-outlined text-[13px] text-outline">calendar_month</span>
                {formatShortDate(event.date)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#0d0d18]/75 backdrop-blur px-2 py-1 text-[10px] font-bold text-on-surface-variant border border-outline-variant/15">
                <span className="material-symbols-outlined text-[13px] text-outline">group</span>
                {event.guests_count}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#0d0d18]/75 backdrop-blur px-2 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                <span className="material-symbols-outlined text-[13px]">how_to_reg</span>
                {event.attendance_rate}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-surface-container-high/80 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-container to-primary"
                  style={{ width: `${event.completion_percent}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-primary tabular-nums shrink-0">
                {event.completion_percent}%
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 px-0.5">
          <h4 className="font-headline text-sm sm:text-[15px] font-extrabold text-on-surface leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h4>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-on-surface-variant">
            <span className="material-symbols-outlined text-[12px] text-outline">calendar_month</span>
            {formatEventDate(event.date, event.time)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${accent} bg-surface-container-low hover:border-primary-container/30 transition-all duration-300`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className="relative h-36 sm:h-auto sm:w-32 lg:w-36 shrink-0 overflow-hidden">
          <EventCoverImage
            coverImage={event.cover_image}
            alt={event.title}
            variant="banner"
          />
          {rank != null && (
            <span className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-[#0d0d18]/80 backdrop-blur text-xs font-bold text-on-surface flex items-center justify-center border border-outline-variant/20">
              {rank}
            </span>
          )}
        </div>

        <div className="flex-1 p-4 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-bold text-sm sm:text-base text-on-surface line-clamp-2 leading-snug">
              {event.title}
            </h4>
            <span
              className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full border ${eventStatusClass(event.status)}`}
            >
              {event.status_label}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-on-surface-variant mb-3">
            <span className="flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-sm text-outline">person</span>
              {event.owner_name}
            </span>
            <span className="flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-sm text-outline">location_on</span>
              {location}
            </span>
            <span className="flex items-center gap-1 truncate col-span-2">
              <span className="material-symbols-outlined text-sm text-outline">calendar_month</span>
              {formatEventDate(event.date, event.time)}
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-2 pt-2 border-t border-outline-variant/10">
            <div className="flex gap-3 text-[11px] tabular-nums">
              <span>
                <span className="text-emerald-400 font-bold">{event.attended_count}</span>
                <span className="text-outline mr-1">حضور</span>
              </span>
              <span>
                <span className="font-bold text-on-surface">{event.guests_count}</span>
                <span className="text-outline mr-1">مدعو</span>
              </span>
              <span>
                <span className="font-bold text-primary">{event.attendance_rate}%</span>
                <span className="text-outline mr-1">نسبة</span>
              </span>
            </div>
            <Link
              href={detailHref}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-colors"
              title="عرض"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
