"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AnalyticsBarChart from "./AnalyticsBarChart";
import ActivityHeatmap from "@/components/charts/ActivityHeatmap";
import EventsTableSection, { EventMiniCards } from "./EventsTableSection";
import { eventsAPI, type EventsOverview, type EventListItem } from "@/lib/api";

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

  useEffect(() => {
    const params = platformId ? { platform: platformId } : undefined;
    Promise.all([
      eventsAPI.overview(params),
      eventsAPI.list({ ...params, page_size: 500 }),
    ])
      .then(([ovRes, listRes]) => {
        setOverview(ovRes.data);
        const raw = listRes.data;
        const list = Array.isArray(raw) ? raw : raw.results ?? [];
        setEvents(list as EventListItem[]);
      })
      .catch(() => {
        setOverview(emptyOverview);
        setEvents([]);
      })
      .finally(() => setLoading(false));
  }, [platformId]);

  const s = overview.stats;

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
        <EventMiniCards title="أحدث 5 فعاليات" events={overview.latest} icon="new_releases" />
        <EventMiniCards
          title="أكثر 5 فعاليات بحضور"
          events={overview.top_attendance}
          icon="groups"
          accent="tertiary"
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
