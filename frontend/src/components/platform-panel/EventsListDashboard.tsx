"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import { highlightMatch } from "@/components/events/HighlightText";
import { eventStatusClass } from "@/components/events/eventStatus";
import PlatformEventShowcaseCard from "@/components/platform-panel/PlatformEventShowcaseCard";
import {
  eventsAPI,
  platformsAPI,
  type PlatformEventRow,
  type PlatformEventStats,
  type PlatformMyEventsResponse,
} from "@/lib/api";

const emptyStats: PlatformEventStats = {
  total: 0,
  completed: 0,
  active_now: 0,
  scheduled: 0,
  draft: 0,
};

function formatJoined(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

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

function cellText(value: string | undefined | null) {
  const t = (value ?? "").trim();
  return t && t !== "—" ? t : "—";
}

function phaseBadgeClass(phase: string) {
  switch (phase) {
    case "setup":
      return "bg-[#5b2eff]/10 text-[#c8bfff] border-[#5b2eff]/25";
    case "sections":
      return "bg-secondary-container/10 text-secondary border-secondary-container/25";
    case "guests":
      return "bg-tertiary/10 text-tertiary border-tertiary/25";
    case "invites":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "attendance":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "completed":
      return "bg-primary-container/10 text-primary border-primary-container/25";
    default:
      return "bg-surface-container-high text-on-surface-variant border-outline-variant/20";
  }
}

function rateColor(rate: number, type: "confirm" | "attend" | "absence") {
  if (type === "absence") {
    if (rate >= 30) return "text-red-400";
    if (rate >= 15) return "text-amber-400";
    return "text-emerald-400";
  }
  if (rate >= 70) return "text-emerald-400";
  if (rate >= 40) return "text-amber-400";
  return "text-red-400";
}

export type EventsListDataSource =
  | "platform-events"
  | "member-events"
  | "organizer-events";

export interface EventsListDashboardProps {
  title: string;
  subtitle?: string;
  dataSource: EventsListDataSource;
  eventsBasePath: string;
  /** platform: أكثر/أقل حضور | event-manager: نشطة + آخر 5 */
  layout?: "platform" | "event-manager";
  showAddButton?: boolean;
  addHref?: string;
  showEditAction?: boolean;
  showDeleteAction?: boolean;
  errorMessage?: string;
}

async function fetchEventsListData(source: EventsListDataSource) {
  if (source === "member-events") {
    return platformsAPI.myMemberEvents();
  }
  if (source === "organizer-events") {
    return platformsAPI.myOrganizerEvents();
  }
  return platformsAPI.myEvents();
}

export default function EventsListDashboard({
  title,
  subtitle,
  dataSource,
  eventsBasePath,
  layout = "platform",
  showAddButton = false,
  addHref = "/platform/events/add",
  showEditAction = false,
  showDeleteAction = false,
  errorMessage = "تعذّر تحميل الفعاليات.",
}: EventsListDashboardProps) {
  const [data, setData] = useState<PlatformMyEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchEventsListData(dataSource);
      setData(res.data);
      setError("");
    } catch {
      setData(null);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [dataSource, errorMessage]);

  useEffect(() => {
    load();
  }, [load]);

  const events = data?.events ?? [];
  const stats = data?.stats ?? emptyStats;
  const subtitleText =
    subtitle ??
    (layout === "platform"
      ? data?.platform?.name
        ? `فعاليات ومناسبات منصة ${data.platform.name}`
        : "جميع فعاليات منصتك في مكان واحد"
      : "المناسبات التي تم تعيينك مديراً عليها — بحث وفلترة وقائمة تفصيلية");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (statusFilter && ev.status !== statusFilter) return false;
      if (phaseFilter && ev.phase !== phaseFilter) return false;
      if (dateFrom && ev.date < dateFrom) return false;
      if (dateTo && ev.date > dateTo) return false;
      if (!q) return true;
      const haystack = [
        String(ev.id),
        ev.title,
        ev.owner_name,
        ev.venue,
        ev.geo_address,
        ev.location,
        ev.date,
        ev.time,
        ev.status_label,
        ev.phase_label,
        ev.event_manager,
        ev.event_organizer,
        ev.coordinators,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [events, search, statusFilter, phaseFilter, dateFrom, dateTo]);

  const handleDelete = async (ev: PlatformEventRow) => {
    if (!window.confirm(`حذف المناسبة «${ev.title}»؟ لا يمكن التراجع.`)) return;
    setDeletingId(ev.id);
    try {
      await eventsAPI.delete(ev.id);
      await load();
    } catch {
      setError("تعذّر حذف المناسبة.");
    } finally {
      setDeletingId(null);
    }
  };

  const kpiCards = [
    { label: "إجمالي الفعاليات", value: stats.total, icon: "celebration", tone: "primary" },
    { label: "المنتهية", value: stats.completed, icon: "check_circle", tone: "muted" },
    { label: "النشطة الآن", value: stats.active_now, icon: "bolt", tone: "emerald" },
    { label: "المجدولة", value: stats.scheduled, icon: "event_upcoming", tone: "tertiary" },
    { label: "المسودة", value: stats.draft, icon: "edit_note", tone: "amber" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/15">
            <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">{title}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{subtitleText}</p>
          </div>
        </div>
        {showAddButton && (
          <Link
            href={addHref}
            className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            إضافة مناسبة
          </Link>
        )}
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 relative overflow-hidden hover:border-primary-container/25 transition-colors"
          >
            <span
              className={`material-symbols-outlined text-lg mb-2 block ${
                card.tone === "emerald"
                  ? "text-emerald-400"
                  : card.tone === "tertiary"
                    ? "text-tertiary"
                    : card.tone === "amber"
                      ? "text-amber-400"
                      : "text-primary"
              }`}
            >
              {card.icon}
            </span>
            <p className="text-[10px] font-bold text-on-surface-variant leading-tight">{card.label}</p>
            <p className="text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {layout === "event-manager" && (
        <>
          <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-emerald-400">bolt</span>
              <h2 className="font-bold text-on-surface">المناسبات النشطة الآن</h2>
            </div>
            {(data?.active_now?.length ?? 0) === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                لا توجد مناسبات نشطة حالياً
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {data!.active_now!.map((ev) => (
                  <PlatformEventShowcaseCard
                    key={ev.id}
                    event={ev}
                    eventsBasePath={eventsBasePath}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-primary">history</span>
              <h2 className="font-bold text-on-surface">آخر 5 مناسبات</h2>
            </div>
            {(data?.recent_events?.length ?? 0) === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">لا توجد مناسبات</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-5xl">
                {data!.recent_events!.map((ev, i) => (
                  <PlatformEventShowcaseCard
                    key={ev.id}
                    event={ev}
                    rank={i + 1}
                    layout="compact"
                    eventsBasePath={eventsBasePath}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {layout === "platform" && (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-emerald-400">trending_up</span>
              <h2 className="font-bold text-on-surface">أكثر 5 فعاليات حضوراً</h2>
            </div>
            {(data?.top_attendance?.length ?? 0) === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">لا توجد بيانات حضور بعد</p>
            ) : (
              <div className="space-y-3">
                {data!.top_attendance.map((ev, i) => (
                  <PlatformEventShowcaseCard
                    key={ev.id}
                    event={ev}
                    rank={i + 1}
                    variant="top"
                    eventsBasePath={eventsBasePath}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-amber-400">trending_down</span>
              <h2 className="font-bold text-on-surface">أقل 5 فعاليات حضوراً</h2>
            </div>
            {(data?.bottom_attendance?.length ?? 0) === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">لا توجد بيانات حضور بعد</p>
            ) : (
              <div className="space-y-3">
                {data!.bottom_attendance.map((ev, i) => (
                  <PlatformEventShowcaseCard
                    key={ev.id}
                    event={ev}
                    rank={i + 1}
                    variant="bottom"
                    eventsBasePath={eventsBasePath}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 space-y-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-on-surface">قائمة المناسبات</h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {filtered.length} من {events.length} مناسبة
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="relative lg:col-span-2">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث فوري ذكي..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="">كل الحالات</option>
              {(data?.status_options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="input-field"
            >
              <option value="">كل المراحل</option>
              {(data?.phase_options ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-field"
              title="من تاريخ"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-field"
              title="إلى تاريخ"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant">لا توجد نتائج مطابقة</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-right min-w-[1200px]">
              <thead>
                <tr className="text-[11px] font-bold text-on-surface-variant border-b border-outline-variant/10">
                  <th className="pb-3 px-2">ID</th>
                  <th className="pb-3 px-2 min-w-[180px]">الاسم</th>
                  <th className="pb-3 px-2">صاحب المناسبة</th>
                  <th className="pb-3 px-2">الموقع</th>
                  <th className="pb-3 px-2 whitespace-nowrap">تاريخ المناسبة</th>
                  <th className="pb-3 px-2">الحالة</th>
                  <th className="pb-3 px-2">المرحلة</th>
                  <th className="pb-3 px-2 whitespace-nowrap">تاريخ الإضافة</th>
                  <th className="pb-3 px-2">الاكتمال</th>
                  <th className="pb-3 px-2 text-center">الضيوف</th>
                  <th className="pb-3 px-2 text-center">تأكيد</th>
                  <th className="pb-3 px-2 text-center">حضور</th>
                  <th className="pb-3 px-2 text-center">غياب</th>
                  <th className="pb-3 px-2 text-center sticky left-0 bg-surface-container-low">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="py-3 px-2 text-xs font-mono text-outline">
                      {highlightMatch(String(ev.id), search)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <div className="w-10 h-10 rounded-xl overflow-hidden border border-outline-variant/10 shrink-0">
                          <EventCoverImage
                            coverImage={ev.cover_image}
                            alt={ev.title}
                            variant="thumb"
                          />
                        </div>
                        <span className="font-bold text-sm text-on-surface line-clamp-2">
                          {highlightMatch(ev.title, search)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-xs text-on-surface-variant max-w-[120px] truncate">
                      {highlightMatch(ev.owner_name, search)}
                    </td>
                    <td className="py-3 px-2 text-xs text-on-surface-variant max-w-[160px]">
                      <span className="truncate block" title={cellText(ev.location)}>
                        {highlightMatch(cellText(ev.location), search)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-on-surface-variant whitespace-nowrap">
                      {highlightMatch(formatEventDate(ev.date, ev.time), search)}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${eventStatusClass(ev.status)}`}
                      >
                        {ev.status_label}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${phaseBadgeClass(ev.phase)}`}
                      >
                        {highlightMatch(ev.phase_label, search)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-outline whitespace-nowrap">
                      {formatJoined(ev.created_at)}
                    </td>
                    <td className="py-3 px-2 min-w-[90px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-l from-primary-container to-primary transition-all"
                            style={{ width: `${ev.completion_percent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-on-surface-variant w-8">
                          {ev.completion_percent}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-sm font-bold tabular-nums">
                      {ev.guests_count}
                    </td>
                    <td
                      className={`py-3 px-2 text-center text-xs font-bold tabular-nums ${rateColor(ev.confirmation_rate, "confirm")}`}
                    >
                      {ev.confirmation_rate}%
                    </td>
                    <td
                      className={`py-3 px-2 text-center text-xs font-bold tabular-nums ${rateColor(ev.attendance_rate, "attend")}`}
                    >
                      {ev.attendance_rate}%
                    </td>
                    <td
                      className={`py-3 px-2 text-center text-xs font-bold tabular-nums ${rateColor(ev.absence_rate, "absence")}`}
                    >
                      {ev.absence_rate}%
                    </td>
                    <td className="py-3 px-2 sticky left-0 bg-surface-container-low">
                      <div className="flex items-center justify-center gap-0.5">
                        <Link
                          href={`${eventsBasePath}/${ev.id}`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10"
                          title="عرض"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </Link>
                        {showEditAction && (
                          <Link
                            href={`${eventsBasePath}/${ev.id}/edit`}
                            className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10"
                            title="تعديل"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </Link>
                        )}
                        {showDeleteAction && (
                          <button
                            type="button"
                            title="حذف"
                            disabled={deletingId === ev.id}
                            onClick={() => handleDelete(ev)}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
