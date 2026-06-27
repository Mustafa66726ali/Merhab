"use client";

import { useEffect, useState } from "react";
import RsvpTrendsChart from "@/components/charts/RsvpTrendsChart";
import RecentActivitiesTable from "@/components/platforms/RecentActivitiesTable";
import {
  platformsAPI,
  type SystemOverview,
  type PlatformKpis,
  type RsvpChartData,
} from "@/lib/api";

const emptyKpis: PlatformKpis = {
  activities_count: 0,
  schedules_count: 0,
  staff_count: 0,
  guests_count: 0,
  attendance_rate: 0,
  confirmation_rate: 0,
};

const emptyChart: RsvpChartData = {
  labels: [],
  confirmed: [],
  declined: [],
  invited: [],
  confirmed_heights: [],
  declined_heights: [],
};

export default function DashboardPage() {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformsAPI.systemOverview()
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const kpis = data?.kpis ?? emptyKpis;
  const rsvp = data?.rsvp_charts ?? { monthly: emptyChart };

  const topKpis = [
    { label: "عدد المناسبات", value: kpis.activities_count.toLocaleString(), color: "primary" },
    { label: "عدد المستخدمين", value: kpis.staff_count.toLocaleString(), color: "tertiary" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8 lg:space-y-10">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {topKpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-low rounded-2xl p-4 sm:p-6 lg:p-8 relative overflow-hidden group">
            <div
              className={
                "absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full -mr-16 -mt-16 " +
                (kpi.color === "primary" ? "bg-primary-container/10" : "bg-tertiary/10")
              }
            />
            <p className="text-on-surface-variant text-sm mb-4 font-label tracking-wider">{kpi.label}</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-on-surface font-headline">{kpi.value}</h2>
          </div>
        ))}

        <div className="bg-primary-container rounded-2xl p-4 sm:p-6 lg:p-8 relative overflow-hidden shadow-[0px_20px_40px_rgba(91,46,255,0.25)] sm:col-span-2 lg:col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-container to-[#4200da] opacity-90" />
          <div className="relative z-10">
            <p className="text-on-primary-container/80 text-sm mb-4 font-label tracking-wider">إجمالي المدعوين</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white font-headline">
              {kpis.guests_count.toLocaleString()}
            </h2>
            <p className="text-white/60 text-xs font-bold mt-2">
              تأكيد: {kpis.confirmation_rate}% · حضور: {kpis.attendance_rate}%
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-8">
          <RsvpTrendsChart
            monthly={rsvp.monthly}
            subtitle="معدل النمو الشهري للمدعوين والفعاليات على مستوى النظام"
          />
        </div>

        <div className="lg:col-span-4">
          <div className="bg-surface-container-high rounded-2xl p-4 sm:p-6 h-full flex flex-col justify-center border border-outline-variant/10">
            <div className="w-12 h-12 bg-tertiary-container/20 text-tertiary rounded-2xl flex items-center justify-center mb-6">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <h4 className="text-lg font-bold text-on-surface mb-2">أداء النظام اللحظي</h4>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
              {kpis.schedules_count} حدث مرتبط بـ {kpis.activities_count} مناسبة على المنصة.
            </p>
            <div className="mt-auto space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>نسبة التأكيد</span>
                  <span className="text-primary">{kpis.confirmation_rate}%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-l from-primary to-primary-container" style={{ width: `${kpis.confirmation_rate}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>نسبة الحضور</span>
                  <span className="text-emerald-400">{kpis.attendance_rate}%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/80" style={{ width: `${kpis.attendance_rate}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-12">
          <RecentActivitiesTable
            activities={data?.recent_activities ?? []}
            subtitle="متابعة الفعاليات المضافة مؤخراً إلى المنصة"
          />
        </div>
      </section>
    </div>
  );
}
