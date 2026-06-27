"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import RsvpTrendsChart from "@/components/charts/RsvpTrendsChart";
import RecentActivitiesTable from "@/components/platforms/RecentActivitiesTable";
import {
  platformsAPI,
  type PlatformMyOverview,
  type PlatformKpiCard,
  type RsvpChartData,
  type PlatformStaffMember,
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
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("ar-SA");
}

function formatChange(card: PlatformKpiCard) {
  const n = Math.abs(card.change_pct);
  const suffix = card.key === "engagement" ? "" : "%";
  return `${n}${suffix}`;
}

function KpiCard({ card }: { card: PlatformKpiCard }) {
  const isUp = card.change_pct >= 0;
  const isTertiary = card.color === "tertiary";
  const glow = isTertiary
    ? "bg-tertiary/10 group-hover:bg-tertiary/20"
    : "bg-primary/10 group-hover:bg-primary/20";

  return (
    <div className="bg-surface-container-high p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${glow} rounded-full blur-2xl transition-all`} />
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
        <span
          className={`text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
            isUp ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
          }`}
        >
          {formatChange(card)}
          <span className="material-symbols-outlined text-[14px]">
            {isUp ? "trending_up" : "trending_down"}
          </span>
        </span>
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

export default function PlatformDashboardView() {
  const { platform } = useAuthStore();
  const [data, setData] = useState<PlatformMyOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformsAPI
      .myOverview()
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

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
  const staff = data?.staff_preview ?? [];

  return (
    <div className="space-y-8 sm:space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">لوحة التحكم</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          نظرة عامة على منصة {platform?.name || data?.platform?.name || "مرحّاب"}
        </p>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {kpiCards.map((card) => <KpiCard key={card.key} card={card} />)}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2">
          <RsvpTrendsChart
            monthly={rsvp.monthly}
            subtitle="معدل تأكيد الحضور والاعتذار لمنصتك — شهرياً"
          />
        </div>

        <div className="bg-surface-container-low p-5 sm:p-8 rounded-2xl flex flex-col border border-outline-variant/10">
          <h3 className="text-lg sm:text-xl font-bold mb-2">نمو الفعاليات</h3>
          <p className="text-sm text-on-surface-variant mb-8">تحليل أداء فعاليات منصتك</p>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[12px] border-surface-container-highest flex items-center justify-center relative">
              <div
                className="absolute inset-0 border-[12px] border-primary-container rounded-full border-t-transparent border-l-transparent"
                style={{ transform: `rotate(${Math.min(growth?.progress_pct ?? 0, 100) * 1.8}deg)` }}
              />
              <div className="text-center">
                <p className="text-3xl sm:text-4xl font-extrabold font-headline">
                  {growth?.progress_pct ?? 0}%
                </p>
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mt-1">
                  {growth?.year_events ?? 0} فعالية هذا العام
                </p>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-container rounded-xl">
              <p className="text-[10px] text-on-surface-variant mb-1">النمو السنوي</p>
              <p className="text-lg font-bold text-emerald-400">
                {growth && growth.yearly_growth_pct >= 0 ? "+" : ""}
                {growth?.yearly_growth_pct ?? 0}%
              </p>
            </div>
            <div className="p-4 bg-surface-container rounded-xl">
              <p className="text-[10px] text-on-surface-variant mb-1">النمو الشهري</p>
              <p className="text-lg font-bold text-primary">
                {growth && growth.monthly_growth_pct >= 0 ? "+" : ""}
                {growth?.monthly_growth_pct ?? 0}%
              </p>
            </div>
          </div>
        </div>
      </section>

      {activities.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg sm:text-xl font-bold">أحدث الفعاليات</h3>
            <Link
              href="/platform/events"
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
                href={`/platform/events/${event.id}`}
                className="min-w-[280px] sm:min-w-[320px] bg-surface-container-high rounded-2xl p-4 group shrink-0 border border-outline-variant/10 hover:border-primary-container/35 hover:bg-surface-container-high/90 transition-all active:scale-[0.98] block"
                title={`عرض تفاصيل ${event.title}`}
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
                <div className="flex flex-wrap items-center gap-3 text-on-surface-variant text-sm mb-3">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {formatDate(event.date)}
                  </span>
                  {event.venue && (
                    <span className="flex items-center gap-1 truncate max-w-[140px]">
                      <span className="material-symbols-outlined text-sm">location_on</span>
                      {event.venue}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="rounded-lg bg-emerald-500/10 px-2 py-1.5">
                    <p className="text-[10px] text-on-surface-variant">حضور</p>
                    <p className="text-sm font-bold text-emerald-400 tabular-nums">
                      {event.attended_count}
                    </p>
                  </div>
                  <div className="rounded-lg bg-error/10 px-2 py-1.5">
                    <p className="text-[10px] text-on-surface-variant">اعتذار</p>
                    <p className="text-sm font-bold text-error tabular-nums">
                      {event.declined_count}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container-lowest px-2 py-1.5">
                    <p className="text-[10px] text-on-surface-variant">لم يرد</p>
                    <p className="text-sm font-bold text-on-surface-variant tabular-nums">
                      {event.no_response_count}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs mb-3 tabular-nums">
                  <span className="text-emerald-400 font-bold">
                    تأكيد {event.confirmation_rate}%
                  </span>
                  <span className="text-primary font-bold">
                    حضور {event.attendance_rate}%
                  </span>
                  <span className="text-on-surface-variant">
                    {event.guests_total} ضيف
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-on-surface-variant">الاكتمال</span>
                    <span className="font-bold text-primary tabular-nums">
                      {event.completion_percent}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-container-lowest overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-l from-primary-container to-primary transition-all"
                      style={{ width: `${event.completion_percent}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-on-surface-variant truncate">
                    المرحلة: {event.phase_label}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-end text-primary text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>عرض التفاصيل</span>
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <RecentActivitiesTable
        activities={activities}
        subtitle="متابعة الفعاليات المضافة مؤخراً إلى منصتك"
        viewAllHref="/platform/events"
        viewAllLabel="عرض كل المناسبات"
      />

      {staff.length > 0 && (
        <section className="bg-surface-container-low rounded-2xl p-5 sm:p-8 border border-outline-variant/10">
          <div className="flex justify-between items-center mb-6 sm:mb-8">
            <h3 className="text-lg sm:text-xl font-bold">أحدث الأعضاء والطاقم</h3>
            <Link
              href="/platform/users"
              className="text-primary text-sm font-bold flex items-center gap-1 hover:underline"
            >
              عرض الكل
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </Link>
          </div>
          <div className="space-y-4 sm:space-y-6">
            {staff.slice(0, 5).map((u: PlatformStaffMember) => (
              <div key={u.id} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary font-bold shrink-0">
                    {u.avatar_initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{u.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">{u.email}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-medium">{u.role_label}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {formatDate(u.joined_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
