"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import EventCoverImage from "@/components/common/EventCoverImage";
import {
  eventStatusHeroClass,
  eventStatusIcon,
} from "@/components/events/eventStatus";
import EventQuickActions from "@/components/platform-panel/EventQuickActions";
import EventSectionGroupsPanel from "@/components/platform-panel/EventSectionGroupsPanel";
import EventSchedulePreview from "@/components/platform-panel/schedule/EventSchedulePreview";
import { eventsAPI, type EventDetail } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const EventLocationMap = dynamic(
  () => import("@/components/platform-panel/EventLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 sm:h-56 rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant text-sm">
        جاري تحميل الخريطة...
      </div>
    ),
  }
);

function formatEventDate(date: string, time: string) {
  if (!date) return "—";
  try {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString("ar-SA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return time ? `${dateStr} · ${time}` : dateStr;
  } catch {
    return date;
  }
}

function formatRelativeTime(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  } catch {
    return iso;
  }
}

function locationText(event: EventDetail) {
  const loc = (event.location || "").trim();
  if (loc && loc !== "—") return loc;
  const venue = (event.venue || "").trim();
  const geo = (event.geo_address || "").trim();
  if (venue && geo) return `${venue} — ${geo}`;
  return venue || geo || "—";
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: string;
  label: string;
  value: number | string;
  hint?: string;
  accent?: "primary" | "tertiary" | "error";
}) {
  const iconWrap =
    accent === "tertiary"
      ? "bg-tertiary-container/20 text-tertiary"
      : accent === "error"
        ? "bg-error/10 text-error"
        : "bg-primary-container/20 text-primary";
  const hintColor =
    accent === "tertiary"
      ? "text-tertiary"
      : accent === "error"
        ? "text-error"
        : "text-primary";

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between min-h-[180px] sm:min-h-[200px] hover:border-primary-container/20 transition-colors">
      <div className="flex justify-between items-start gap-3">
        <div className={`p-3 rounded-xl ${iconWrap}`}>
          <span className="material-symbols-outlined text-2xl sm:text-3xl">{icon}</span>
        </div>
        {hint && (
          <span className={`text-[10px] sm:text-xs font-bold tracking-wide ${hintColor}`}>
            {hint}
          </span>
        )}
      </div>
      <div>
        <p className="text-on-surface-variant font-medium text-sm mb-1">{label}</p>
        <p className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}

function SectionGroupBar({
  name,
  confirmed,
  total,
  color,
}: {
  name: string;
  confirmed: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-2 gap-2">
        <span className="text-on-surface truncate">{name}</span>
        <span className="font-bold tabular-nums shrink-0" style={{ color }}>
          {confirmed} / {total}
        </span>
      </div>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface PlatformEventDetailViewProps {
  eventId: number;
  eventsBasePath?: string;
}

export default function PlatformEventDetailView({
  eventId,
  eventsBasePath = "/platform/events",
}: PlatformEventDetailViewProps) {
  const user = useAuthStore((s) => s.user);
  const isEventManager = user?.role === "event_manager";
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await eventsAPI.get(eventId);
      setEvent(res.data);
      setError("");
    } catch {
      setEvent(null);
      setError("تعذّر تحميل تفاصيل المناسبة.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = event?.stats;

  const sectionBreakdown = useMemo(() => {
    if (!event?.sections?.length) return [];
    return event.sections.map((section) => ({
      id: section.id,
      name: section.name,
      confirmed: section.guests_confirmed,
      total: section.guests_count,
      color: section.color || "#5b2eff",
    }));
  }, [event]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center space-y-4">
        <p className="text-on-surface-variant">{error || "المناسبة غير موجودة."}</p>
        <Link
          href={eventsBasePath}
          className="inline-flex items-center gap-2 text-primary hover:underline text-sm font-bold"
        >
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          العودة إلى قائمة المناسبات
        </Link>
      </div>
    );
  }

  const loc = locationText(event);
  const confirmedDisplay = (stats?.confirmed ?? 0) + (stats?.attended ?? 0);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Link href={eventsBasePath} className="hover:text-primary transition-colors">
          المناسبات
        </Link>
        <span className="material-symbols-outlined text-base text-outline">chevron_left</span>
        <span className="text-on-surface font-medium truncate">{event.title}</span>
      </nav>

      <EventQuickActions eventId={eventId} eventsBasePath={eventsBasePath} />

      {/* Hero */}
      <section className="relative rounded-[1.5rem] sm:rounded-[2rem] overflow-hidden shadow-2xl shadow-black/30 min-h-[280px] sm:min-h-[360px] lg:min-h-[400px]">
        <div className="absolute inset-0">
          <EventCoverImage
            coverImage={event.cover_image}
            alt={event.title}
            variant="hero"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        <div className="relative z-10 flex flex-col justify-end min-h-[280px] sm:min-h-[360px] lg:min-h-[400px] p-6 sm:p-8 lg:p-10">
          <div
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-4 ${eventStatusHeroClass(event.status)}`}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {eventStatusIcon(event.status)}
            </span>
            {event.status_label}
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface mb-3 leading-tight font-headline">
            {event.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm text-on-surface-variant">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
              {formatEventDate(event.date, event.time)}
            </span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-lg shrink-0">location_on</span>
              <span className="truncate max-w-[280px] sm:max-w-md">{loc}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Bento grid */}
      <div className="grid grid-cols-12 gap-4 sm:gap-6">
        {/* Metrics */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <MetricCard
            icon="groups"
            label="إجمالي المدعوين"
            value={stats?.guests_total ?? 0}
            hint={
              stats && stats.guests_total > 0
                ? `${stats.confirmation_rate}% تأكيد`
                : undefined
            }
          />
          <MetricCard
            icon="how_to_reg"
            label="الحضور المؤكد"
            value={confirmedDisplay}
            hint={
              stats && stats.guests_total > 0
                ? `${stats.attendance_rate}% حضور فعلي`
                : undefined
            }
            accent="tertiary"
          />
          <MetricCard
            icon="pending_actions"
            label="لم يتم الرد"
            value={stats?.no_response ?? 0}
            hint={stats?.no_response ? "تحتاج انتباه" : undefined}
            accent="error"
          />
        </div>

        {/* Completion */}
        <div className="col-span-12 lg:col-span-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary-container/30 to-tertiary-container/20" />
          <div className="relative z-10">
            <div
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-primary-container border-t-transparent mb-4 sm:mb-6 flex items-center justify-center mx-auto"
              style={{
                background: `conic-gradient(#5b2eff ${event.completion_percent}%, transparent 0)`,
              }}
            >
              <span className="text-xl sm:text-2xl font-bold text-on-surface tabular-nums bg-surface-container-low rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                {event.completion_percent}%
              </span>
            </div>
            <h4 className="text-lg sm:text-xl font-bold text-on-surface mb-2">اكتمال التحضيرات</h4>
            <p className="text-on-surface-variant text-sm px-2">
              المرحلة الحالية: <span className="text-primary font-bold">{event.phase_label}</span>
            </p>
          </div>
        </div>

        {/* Summary + map */}
        <div className="col-span-12 lg:col-span-7 rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8 lg:p-10">
          <h3 className="text-xl sm:text-2xl font-bold text-on-surface mb-6 sm:mb-8">ملخص المناسبة</h3>

          <div className="space-y-6 sm:space-y-8">
            <div className="flex items-start gap-4 sm:gap-6">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-surface-container-high rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">description</span>
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-on-surface font-bold mb-1">وصف الحدث</h5>
                <p className="text-on-surface-variant leading-relaxed text-sm sm:text-base">
                  {event.description?.trim() || "لا يوجد وصف لهذه المناسبة بعد."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 sm:gap-6">
              <div className="w-11 h-11 sm:w-12 sm:h-12 bg-surface-container-high rounded-full flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">map</span>
              </div>
              <div className="min-w-0 flex-1">
                <h5 className="text-on-surface font-bold mb-1">موقع الحدث</h5>
                <p className="text-on-surface-variant mb-4 text-sm sm:text-base">{loc}</p>
                <EventLocationMap
                  latitude={event.latitude != null ? Number(event.latitude) : null}
                  longitude={event.longitude != null ? Number(event.longitude) : null}
                />
              </div>
            </div>

            {(event.event_manager !== "—" || event.event_organizer !== "—") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {event.event_manager !== "—" && (
                  <div className="rounded-xl bg-surface-container-high/50 p-4">
                    <p className="text-xs text-on-surface-variant mb-1">مدير الفعالية</p>
                    <p className="font-bold text-on-surface">{event.event_manager}</p>
                  </div>
                )}
                {event.event_organizer !== "—" && (
                  <div className="rounded-xl bg-surface-container-high/50 p-4">
                    <p className="text-xs text-on-surface-variant mb-1">منظم الفعالية</p>
                    <p className="font-bold text-on-surface">{event.event_organizer}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar column */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 sm:gap-6">
          <EventSchedulePreview event={event} eventsBasePath={eventsBasePath} />

          <EventSectionGroupsPanel
            eventId={eventId}
            sections={event.sections}
            canManage={isEventManager}
            onRefresh={load}
          />

          {/* Guest distribution by section */}
          {sectionBreakdown.length > 0 && (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8">
              <h4 className="text-lg sm:text-xl font-bold text-on-surface mb-4 sm:mb-6">
                توزيع المدعوين
              </h4>
              <div className="space-y-4">
                {sectionBreakdown.map((row) => (
                  <SectionGroupBar
                    key={row.id}
                    name={row.name}
                    confirmed={row.confirmed}
                    total={row.total}
                    color={row.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-6 sm:p-8 flex-grow">
            <h4 className="text-lg sm:text-xl font-bold text-on-surface mb-4 sm:mb-6">آخر التحديثات</h4>
            {event.recent_activity.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-4">لا توجد تحديثات حديثة</p>
            ) : (
              <div className="space-y-5">
                {event.recent_activity.map((item) => {
                  const dotColor =
                    item.tone === "error"
                      ? "bg-error"
                      : item.tone === "tertiary"
                        ? "bg-tertiary"
                        : "bg-primary";
                  return (
                    <div key={item.id} className="flex gap-4">
                      <div className={`w-2 h-2 rounded-full ${dotColor} mt-2 shrink-0`} />
                      <div className="min-w-0">
                        <p className="text-on-surface text-sm font-medium">{item.message}</p>
                        <span className="text-on-surface-variant text-xs">
                          {formatRelativeTime(item.at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
