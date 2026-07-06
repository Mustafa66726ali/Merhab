"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AnalyticsBarChart from "./AnalyticsBarChart";
import ActivityHeatmap from "@/components/charts/ActivityHeatmap";
import EventsTableSection, { EventMiniCards } from "./EventsTableSection";
import {
  eventsAPI,
  extractApiList,
  type EventsOverview,
  type EventListItem,
} from "@/lib/api";

interface EventsDashboardProps {
  platformId?: number;
  platformName?: string;
  backHref?: string;
  backLabel?: string;
  showPlatformInTable?: boolean;
}

const emptyOverview: EventsOverview = {
  stats: {
    total: 0,
    completed: 0,
    cancelled: 0,
    active: 0,
    archived: 0,
    draft: 0,
    confirmation_rate: 0,
    non_confirmation_rate: 0,
  },
  latest: [],
  top_attendance: [],
  charts: {
    weekday: { labels: [], values: [], heights: [] },
    monthly: { labels: [], values: [], heights: [] },
    growth: { labels: [], values: [], heights: [] },
    peak: {
      day_labels: [],
      hour_labels: [],
      matrix: Array.from({ length: 7 }, () => Array(6).fill(0)),
      max: 1,
    },
  },
};

export default function EventsDashboard({
  platformId,
  platformName,
  backHref,
  backLabel,
  showPlatformInTable = true,
}: EventsDashboardProps) {
  const [overview, setOverview] = useState<EventsOverview>(emptyOverview);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const params = platformId ? { platform: platformId } : undefined;
    let cancelled = false;

    setLoading(true);
    setLoadError("");

    const listPromise = eventsAPI
      .list({ ...params, page_size: 500 })
      .then((listRes) => {
        if (cancelled) return;
        setEvents(extractApiList<EventListItem>(listRes.data));
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setLoadError("تعذّر تحميل قائمة الفعاليات من الخادم.");
      });

    const overviewPromise = eventsAPI
      .overview(params)
      .then((ovRes) => {
        if (cancelled) return;
        setOverview(ovRes.data);
      })
      .catch(() => {
        if (cancelled) return;
        setOverview(emptyOverview);
      });

    Promise.all([listPromise, overviewPromise]).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [platformId]);

  const s = useMemo(() => {
    if (events.length === 0) return overview.stats;

    const totalGuests = events.reduce((sum, ev) => sum + (ev.guests_count || 0), 0);
    const totalConfirmed = events.reduce((sum, ev) => sum + (ev.confirmed_count || 0), 0);
    const confirmationRate =
      totalGuests > 0
        ? Math.round(Math.min(100, (totalConfirmed / totalGuests) * 100) * 10) / 10
        : 0;

    return {
      total: events.length,
      completed: events.filter((ev) => ev.status === "completed").length,
      cancelled: events.filter((ev) => ev.status === "cancelled").length,
      active: events.filter((ev) => ev.status === "active").length,
      archived: events.filter((ev) => ev.status === "archived").length,
      draft: events.filter((ev) => ev.status === "draft").length,
      confirmation_rate: confirmationRate,
      non_confirmation_rate: Math.round(Math.min(100, 100 - confirmationRate) * 10) / 10,
    };
  }, [events, overview.stats]);

  const latestFive = useMemo(
    () =>
      [...events]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 5),
    [events]
  );

  const topAttendanceFive = useMemo(
    () =>
      [...events]
        .filter((ev) => (ev.guests_count || 0) > 0)
        .sort(
          (a, b) =>
            (b.attended_count || 0) - (a.attended_count || 0) ||
            (b.confirmed_count || 0) - (a.confirmed_count || 0) ||
            (b.guests_count || 0) - (a.guests_count || 0)
        )
        .slice(0, 5),
    [events]
  );

  const kpiCards = [
    { label: "إجمالي المناسبات", value: s.total, icon: "celebration", color: "primary" },
    { label: "مكتملة / منتهية", value: s.completed, icon: "check_circle", color: "primary" },
    { label: "ملغية", value: s.cancelled, icon: "cancel", color: "tertiary" },
    { label: "تعمل الآن", value: s.active, icon: "bolt", color: "emerald" },
    { label: "مؤرشفة", value: s.archived, icon: "inventory_2", color: "muted" },
    { label: "نسبة التأكيد", value: `${s.confirmation_rate}%`, icon: "mark_email_read", color: "primary" },
    { label: "عدم التأكيد", value: `${s.non_confirmation_rate}%`, icon: "mail_off", color: "tertiary" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            {backLabel || "العودة"}
          </Link>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
          {platformName ? `مناسبات ${platformName}` : "الفعاليات والمناسبات"}
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          {platformName
            ? "جميع الفعاليات والمناسبات في المنصة المختارة"
            : "عرض جميع الفعاليات والمناسبات في كل المنصات"}
        </p>
        {loadError && (
          <p className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
            {loadError}
          </p>
        )}
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3 sm:p-4 relative overflow-hidden group hover:border-primary-container/25 transition-colors"
          >
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary-container/10 blur-[40px] rounded-full -mr-6 -mt-6" />
            <span className="material-symbols-outlined text-lg text-primary mb-2 block">{card.icon}</span>
            <p className="text-[10px] font-bold text-on-surface-variant leading-tight">{card.label}</p>
            <p className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <EventMiniCards title="أحدث 5 فعاليات" events={latestFive} icon="new_releases" />
        <EventMiniCards
          title="أكثر 5 فعاليات بحضور"
          events={topAttendanceFive}
          icon="groups"
          accent="tertiary"
          emptyMessage="لا توجد فعاليات بضيوف مسجّلين بعد"
        />
      </section>

      <EventsTableSection events={events} showPlatform={showPlatformInTable} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <AnalyticsBarChart
          title="مقارنة الفعاليات حسب أيام الأسبوع"
          subtitle="توزيع إنشاء الفعاليات"
          data={overview.charts.weekday}
        />
        <AnalyticsBarChart
          title="الفعاليات حسب شهور السنة"
          subtitle={`سنة ${new Date().getFullYear()}`}
          data={overview.charts.monthly}
          color="tertiary"
        />
        <AnalyticsBarChart
          title="معدل الزيادة"
          subtitle="آخر 6 أشهر"
          data={overview.charts.growth}
        />
        <ActivityHeatmap
          title="خريطة ذروة النشاط"
          subtitle="شدة إنشاء الفعاليات حسب اليوم والوقت — أغمق = نشاط أعلى"
          data={overview.charts.peak}
        />
      </section>
    </div>
  );
}
