"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import RsvpTrendsChart from "@/components/charts/RsvpTrendsChart";
import RecentActivitiesTable from "@/components/platforms/RecentActivitiesTable";
import {
  platformsAPI,
  type EventManagerMyOverview,
  type PlatformKpiCard,
  type RsvpChartData,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const emptyChart: RsvpChartData = {
  labels: [],
  confirmed: [],
  declined: [],
  invited: [],
  confirmed_heights: [],
  declined_heights: [],
};

function formatKpiValue(value: number, isPercent?: boolean) {
  if (isPercent) return `${value}%`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("ar-SA");
}

function KpiCard({ card }: { card: PlatformKpiCard }) {
  const isUp = card.change_pct >= 0;
  const isTertiary = card.color === "tertiary";
  return (
    <div className="bg-surface-container-high p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div
        className={`absolute -right-4 -top-4 w-24 h-24 ${
          isTertiary ? "bg-tertiary/10" : "bg-primary/10"
        } rounded-full blur-2xl`}
      />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div
          className={`p-3 rounded-xl ${
            isTertiary ? "bg-tertiary-container/20" : "bg-primary-container/20"
          }`}
        >
          <span
            className={`material-symbols-outlined ${
              isTertiary ? "text-tertiary" : "text-primary-fixed-dim"
            }`}
          >
            {card.icon}
          </span>
        </div>
        {card.change_pct !== 0 && (
          <span
            className={`text-xs font-bold px-2 py-1 rounded-lg ${
              isUp ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
            }`}
          >
            {Math.abs(card.change_pct)}%
          </span>
        )}
      </div>
      <p className="text-on-surface-variant text-sm font-medium mb-1">{card.label}</p>
      <h3 className="text-2xl sm:text-3xl font-extrabold text-on-surface font-headline">
        {formatKpiValue(card.value, card.is_percent)}
      </h3>
    </div>
  );
}

function formatDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

interface EventManagerDashboardViewProps {
  /** المسار الأساسي للوحة (مدير/منظم الفعالية) لبناء الروابط. */
  basePath?: string;
  /** دالة جلب النظرة العامة — تُحدّد نطاق البيانات حسب الحساب. */
  fetchOverview?: () => Promise<{ data: EventManagerMyOverview }>;
  /** رابط صفحة فريق العمل — مرّر null لإخفاء رابط "عرض الكل". */
  teamHref?: string | null;
}

export default function EventManagerDashboardView({
  basePath = "/event-manager",
  fetchOverview = platformsAPI.myMemberOverview,
  teamHref = "/event-manager/team",
}: EventManagerDashboardViewProps = {}) {
  const { platform } = useAuthStore();
  const [data, setData] = useState<EventManagerMyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOverview()
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [fetchOverview]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  const kpiCards = data?.kpi_cards ?? [];
  const rsvp = data?.rsvp_charts ?? { monthly: emptyChart };
  const growth = data?.event_growth;
  const activities = data?.recent_activities ?? [];
  const team = data?.team_preview ?? [];

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
          لوحة تحكم الفعالية
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          نظرة عامة على المناسبات المُعيَّن عليها — {platform?.name || data?.platform?.name}
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {kpiCards.map((card) => <KpiCard key={card.key} card={card} />)}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2">
          <RsvpTrendsChart
            monthly={rsvp.monthly}
            subtitle="معدل تأكيد الحضور والاعتذار لمناسباتك — شهرياً"
          />
        </div>
        <div className="bg-surface-container-low p-5 sm:p-8 rounded-2xl flex flex-col border border-outline-variant/10">
          <h3 className="text-lg sm:text-xl font-bold mb-2">نمو المناسبات</h3>
          <p className="text-sm text-on-surface-variant mb-8">أداء المناسبات التي تديرها</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[12px] border-surface-container-highest flex items-center justify-center relative">
              <div
                className="absolute inset-0 border-[12px] border-primary-container rounded-full border-t-transparent border-l-transparent"
                style={{
                  transform: `rotate(${Math.min(growth?.progress_pct ?? 0, 100) * 1.8}deg)`,
                }}
              />
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold font-headline">
                  {growth?.progress_pct ?? 0}%
                </p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                  {growth?.year_events ?? 0} مناسبة هذا العام
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {activities.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold">أحدث المناسبات</h3>
            <Link
              href={`${basePath}/events`}
              className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
            >
              عرض الكل
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </Link>
          </div>
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 scrollbar-thin">
            {activities.map((event) => (
              <Link
                key={event.id}
                href={`${basePath}/events/${event.id}`}
                className="min-w-[280px] sm:min-w-[320px] bg-surface-container-high rounded-2xl p-4 group shrink-0 border border-outline-variant/10 hover:border-primary-container/35 transition-all block"
              >
                <div className="relative h-36 sm:h-40 mb-4 rounded-xl overflow-hidden">
                  <EventCoverImage
                    coverImage={event.cover_image}
                    alt={event.title}
                    variant="banner"
                  />
                  <div className="absolute top-3 right-3 bg-surface-container-lowest/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-bold text-primary">
                    {event.status_label}
                  </div>
                </div>
                <h4 className="text-base sm:text-lg font-bold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {event.title}
                </h4>
                <div className="flex flex-wrap gap-3 text-on-surface-variant text-sm mb-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {formatDate(event.date)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs tabular-nums">
                  <span className="text-emerald-400 font-bold">
                    تأكيد {event.confirmation_rate}%
                  </span>
                  <span className="text-on-surface-variant">{event.guests_total} ضيف</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <RecentActivitiesTable
        activities={activities}
        subtitle="متابعة المناسبات التي تديرها"
        viewAllHref={`${basePath}/events`}
        viewAllLabel="عرض كل المناسبات"
      />

      {team.length > 0 && (
        <section className="bg-surface-container-low rounded-2xl p-5 sm:p-8 border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold">فريق العمل</h3>
            {teamHref && (
              <Link
                href={teamHref}
                className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
              >
                عرض الكل
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </Link>
            )}
          </div>
          <div className="space-y-4">
            {team.map((member) => (
              <div key={`${member.id}-${member.event_title}`} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-bold shrink-0">
                    {member.avatar_initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{member.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {member.role_label} · {member.event_title}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
