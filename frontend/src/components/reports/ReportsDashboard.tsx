"use client";

import { useCallback, useEffect, useState } from "react";
import AnalyticsBarChart from "@/components/events/AnalyticsBarChart";
import ActivityHeatmap from "@/components/charts/ActivityHeatmap";
import RsvpTrendsChart from "@/components/charts/RsvpTrendsChart";
import MetricHistoryChart from "@/components/monitoring/MetricHistoryChart";
import RecentActivitiesTable from "@/components/platforms/RecentActivitiesTable";
import { exportSectionToPdf } from "@/lib/exportReportPdf";
import {
  reportsAPI,
  platformsAPI,
  type ReportsDashboardData,
  type ReportSection,
  type EventChartSeries,
  type RsvpChartData,
  type ActivityHeatmapData,
} from "@/lib/api";

const emptyDashboard: ReportsDashboardData = {
  generated_at: "",
  overview_kpis: [],
  growth_summary: [],
  sections: [],
  suggestions: [],
  recent_activities: [],
  rsvp_charts: { monthly: { labels: [], confirmed: [], declined: [], invited: [], confirmed_heights: [], declined_heights: [] } },
};

function GrowthBadge({ growth }: { growth: number }) {
  const positive = growth >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-bold tabular-nums ${
        positive ? "text-emerald-400" : "text-red-400"
      }`}
    >
      <span className="material-symbols-outlined text-sm">
        {positive ? "trending_up" : "trending_down"}
      </span>
      {growth > 0 ? "+" : ""}{growth}%
    </span>
  );
}

function SectionCharts({ section }: { section: ReportSection }) {
  if (!section.charts.length) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      {section.charts.map((chart) => {
        if (chart.type === "rsvp") {
          return (
            <div key={chart.id} className="md:col-span-2">
              <RsvpTrendsChart
                monthly={chart.data as RsvpChartData}
                subtitle={chart.title}
              />
            </div>
          );
        }
        if (chart.type === "heatmap") {
          return (
            <div key={chart.id} className="md:col-span-2">
              <ActivityHeatmap
                title={chart.title}
                subtitle="شدة النشاط حسب اليوم والفترة الزمنية"
                data={chart.data as ActivityHeatmapData}
              />
            </div>
          );
        }
        return (
          <AnalyticsBarChart
            key={chart.id}
            title={chart.title}
            data={chart.data as EventChartSeries}
            color={chart.color ?? "primary"}
          />
        );
      })}
    </div>
  );
}

function SectionTable({ table }: { table: ReportSection["table"] }) {
  if (!table || table.rows.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-outline-variant/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-outline-variant/10 bg-surface-container-high/50">
            {table.headers.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-bold text-on-surface-variant text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/10">
          {table.rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-container/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-on-surface-variant text-xs">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ReportsDashboardProps {
  mode?: "system" | "platform";
}

export default function ReportsDashboard({ mode = "system" }: ReportsDashboardProps) {
  const [data, setData] = useState<ReportsDashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res =
        mode === "platform"
          ? await platformsAPI.myReports()
          : await reportsAPI.dashboard();
      setData(res.data);
    } catch {
      setData(emptyDashboard);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const filteredSections =
    activeSection === "all"
      ? data.sections
      : data.sections.filter((s) => s.id === activeSection);

  const growthChart = data.growth_summary;
  const growthLabels = growthChart.map((g) => g.label);
  const growthValues = growthChart.map((g) => g.growth);

  const isPlatform = mode === "platform";
  const pageTitle = isPlatform ? "تقارير المنصة" : "التقارير والإحصائيات";
  const pageSubtitle = isPlatform
    ? data.platform_name
      ? `إحصائيات وتقارير منصة «${data.platform_name}» — فعاليات، ضيوف، وأعضاء فقط`
      : "إحصائيات وتقارير منصتك — فعاليات، ضيوف، وأعضاء"
    : "لوحة شاملة لأداء المنصة — فعاليات، ضيوف، منصات، تكاملات، ومحتوى";
  const activitiesHref = isPlatform ? "/platform/events" : "/events";
  const activitiesSubtitle = isPlatform
    ? "آخر الفعاليات المضافة في منصتك"
    : "آخر الفعاليات المضافة في النظام";

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              analytics
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              {pageTitle}
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              {pageSubtitle}
            </p>
            {data.generated_at && (
              <p className="text-[10px] text-outline mt-1">
                آخر تحديث: {new Date(data.generated_at).toLocaleString("ar-SA")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20 disabled:opacity-50 self-start"
        >
          <span className={`material-symbols-outlined text-lg ${refreshing ? "animate-spin" : ""}`}>
            refresh
          </span>
          تحديث البيانات
        </button>
      </div>

      {/* Overview KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {data.overview_kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 relative overflow-hidden hover:border-primary-container/20 transition-colors"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/10 blur-[40px] rounded-full -mr-8 -mt-8" />
            <span className="material-symbols-outlined text-primary text-lg mb-2 block relative z-10">
              {kpi.icon}
            </span>
            <p className="text-[10px] font-bold text-on-surface-variant relative z-10">{kpi.label}</p>
            <p className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums relative z-10">
              {typeof kpi.value === "number" ? kpi.value.toLocaleString("ar-SA") : kpi.value}
            </p>
          </div>
        ))}
      </section>

      {/* Growth + RSVP row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
            <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">trending_up</span>
              نسب النمو (الشهر الحالي vs السابق)
            </h3>
            <div className="space-y-3">
              {data.growth_summary.map((g) => (
                <div
                  key={g.label}
                  className="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/10 last:border-0"
                >
                  <div>
                    <p className="text-sm font-bold text-on-surface">{g.label}</p>
                    <p className="text-[10px] text-outline tabular-nums">
                      {g.current.toLocaleString("ar-SA")} مقابل {g.previous.toLocaleString("ar-SA")}
                    </p>
                  </div>
                  <GrowthBadge growth={g.growth} />
                </div>
              ))}
            </div>
          </div>

          {data.suggestions.length > 0 && (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
              <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-lg">lightbulb</span>
                اقتراحات ذكية
              </h3>
              <div className="space-y-3">
                {data.suggestions.slice(0, 4).map((tip) => (
                  <div
                    key={tip.title}
                    className={`rounded-xl p-3 border ${
                      tip.priority === "high"
                        ? "border-red-500/25 bg-red-500/5"
                        : tip.priority === "medium"
                          ? "border-amber-500/25 bg-amber-500/5"
                          : "border-outline-variant/15 bg-surface-container/30"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base shrink-0">
                        {tip.icon}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-on-surface">{tip.title}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5 leading-relaxed">
                          {tip.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 space-y-4">
          <MetricHistoryChart
            title="معدلات النمو الشهرية"
            subtitle="مقارنة الشهر الحالي مع السابق لكل مؤشر"
            labels={growthLabels}
            values={growthValues}
            unit="%"
            color="primary"
          />
          <RsvpTrendsChart
            monthly={data.rsvp_charts.monthly}
            subtitle="اتجاهات RSVP على مستوى النظام — 12 شهراً"
          />
        </div>
      </section>

      {/* Section filter */}
      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSection("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            activeSection === "all"
              ? "border-primary-container/50 bg-primary-container/15 text-primary"
              : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
          }`}
        >
          كل الأقسام
        </button>
        {data.sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              activeSection === s.id
                ? "border-primary-container/50 bg-primary-container/15 text-primary"
                : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
            }`}
          >
            <span className="material-symbols-outlined text-sm">{s.icon}</span>
            {s.title}
            {!s.implemented && (
              <span className="text-[9px] text-outline">قريباً</span>
            )}
          </button>
        ))}
      </section>

      {/* Report sections */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <section
            key={section.id}
            id={`report-${section.id}`}
            className={`rounded-2xl border p-4 sm:p-6 lg:p-8 transition-all ${
              section.implemented
                ? "border-outline-variant/10 bg-surface-container-low"
                : "border-outline-variant/10 bg-surface-container/20 opacity-75"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    section.implemented ? "bg-primary-container/20" : "bg-surface-container-high"
                  }`}
                >
                  <span className="material-symbols-outlined text-primary text-xl">{section.icon}</span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-bold text-on-surface font-headline">
                      {section.title}
                    </h2>
                    {!section.implemented && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/30 text-outline">
                        قيد التطوير
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{section.description}</p>
                </div>
              </div>
              {section.implemented && (
                <button
                  type="button"
                  onClick={() => exportSectionToPdf(section, data.generated_at)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 bg-surface-container-high hover:bg-primary-container/10 hover:border-primary-container/30 hover:text-primary transition-all self-start shrink-0"
                >
                  <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                  تصدير PDF
                </button>
              )}
            </div>

            {section.implemented ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {section.kpis.map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-outline-variant/10 bg-surface-container/40 p-3"
                    >
                      <p className="text-[10px] font-bold text-on-surface-variant">{kpi.label}</p>
                      <p className="text-lg font-extrabold text-on-surface font-headline tabular-nums mt-1">
                        {typeof kpi.value === "number"
                          ? kpi.value.toLocaleString("ar-SA")
                          : kpi.value}
                      </p>
                    </div>
                  ))}
                </div>
                <SectionCharts section={section} />
                <SectionTable table={section.table} />
              </>
            ) : (
              <div className="text-center py-8 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-4xl text-outline/40 mb-2 block">construction</span>
                سيتم إضافة التقارير والإحصائيات لهذا القسم قريباً
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Recent activities */}
      <section>
        <RecentActivitiesTable
          activities={data.recent_activities}
          subtitle={activitiesSubtitle}
          viewAllHref={activitiesHref}
          viewAllLabel="عرض كل الفعاليات"
        />
      </section>
    </div>
  );
}
