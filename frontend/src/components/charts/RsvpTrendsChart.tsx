"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface RsvpChartData {
  labels: string[];
  confirmed: number[];
  declined: number[];
  invited?: number[];
  confirmed_heights: string[];
  declined_heights: string[];
}

interface RsvpTrendsChartProps {
  monthly: RsvpChartData;
  subtitle?: string;
}

function pct(value: number, max: number) {
  if (max <= 0) return 5;
  return Math.max(Math.round((value / max) * 100), value > 0 ? 8 : 5);
}

export default function RsvpTrendsChart({
  monthly,
  subtitle = "معدل النمو الشهري للمدعوين والفعاليات",
}: RsvpTrendsChartProps) {
  const chart = monthly;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);

  const activeIndex = pinnedIndex ?? hoveredIndex;

  const stats = useMemo(() => {
    const totalConfirmed = chart.confirmed.reduce((a, b) => a + b, 0);
    const totalDeclined = chart.declined.reduce((a, b) => a + b, 0);
    const maxBar = Math.max(...chart.confirmed, ...chart.declined, 1);
    let peakIdx = 0;
    let peakVal = 0;
    chart.labels.forEach((_, i) => {
      const t = chart.confirmed[i] + chart.declined[i];
      if (t > peakVal) {
        peakVal = t;
        peakIdx = i;
      }
    });
    const now = new Date();
    const currentMonthIdx = now.getMonth();
    return { totalConfirmed, totalDeclined, maxBar, peakIdx, peakVal, currentMonthIdx };
  }, [chart]);

  const activeData =
    activeIndex !== null
      ? {
          label: chart.labels[activeIndex],
          confirmed: chart.confirmed[activeIndex],
          declined: chart.declined[activeIndex],
          total: chart.confirmed[activeIndex] + chart.declined[activeIndex],
        }
      : null;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-outline-variant/10 bg-surface-container-low">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary-container/15 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-tertiary/10 blur-[70px]" />

      <div className="relative p-4 sm:p-6 lg:p-8">
        {/* header */}
        <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
              <span
                className="material-symbols-outlined text-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bar_chart
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface sm:text-xl font-headline">
                اتجاهات تأكيد الحضور (RSVP)
              </h3>
              <p className="mt-0.5 text-sm text-on-surface-variant">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-container/25 bg-primary-container/10 px-3 py-1.5 text-[11px] font-bold text-primary">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              شهري — جميع الشهور
            </span>
            {pinnedIndex !== null && (
              <button
                type="button"
                onClick={() => setPinnedIndex(null)}
                className="inline-flex items-center gap-1 rounded-full border border-outline-variant/25 px-3 py-1.5 text-[11px] font-bold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                إلغاء التحديد
              </button>
            )}
          </div>
        </div>

        {/* summary KPIs */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-primary-container/15 bg-gradient-to-br from-primary-container/10 to-transparent p-3 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">تم التأكيد</p>
            <p className="mt-1 text-xl font-extrabold text-primary sm:text-2xl font-headline tabular-nums">
              {stats.totalConfirmed.toLocaleString("ar-SA")}
            </p>
          </div>
          <div className="rounded-xl border border-tertiary/15 bg-gradient-to-br from-tertiary/10 to-transparent p-3 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">اعتذر</p>
            <p className="mt-1 text-xl font-extrabold text-tertiary sm:text-2xl font-headline tabular-nums">
              {stats.totalDeclined.toLocaleString("ar-SA")}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container/50 p-3 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">أعلى شهر</p>
            <p className="mt-1 text-base font-extrabold text-on-surface sm:text-lg font-headline">
              {chart.labels[stats.peakIdx]}
            </p>
            <p className="text-[10px] text-on-surface-variant">{stats.peakVal} مدعو</p>
          </div>
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container/50 p-3 sm:p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">نسبة التأكيد</p>
            <p className="mt-1 text-xl font-extrabold text-emerald-400 sm:text-2xl font-headline tabular-nums">
              {stats.totalConfirmed + stats.totalDeclined > 0
                ? Math.round(
                    (stats.totalConfirmed / (stats.totalConfirmed + stats.totalDeclined)) * 100
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        {/* legend */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 text-xs text-on-surface-variant">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-gradient-to-t from-primary-container to-primary shadow-[0_0_8px_rgba(91,46,255,0.5)]" />
              تم التأكيد
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-gradient-to-t from-tertiary-container to-tertiary shadow-[0_0_8px_rgba(255,181,155,0.4)]" />
              اعتذر عن الحضور
            </span>
          </div>
          <p className="text-[10px] text-outline hidden sm:block">
            مرّر أو انقر على شهر لعرض التفاصيل
          </p>
        </div>

        {/* chart area */}
        <div className="relative">
          {/* floating tooltip */}
          <AnimatePresence>
            {activeData && (
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.2 }}
                className="absolute left-1/2 top-0 z-20 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-4"
              >
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-high/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-md min-w-[200px]">
                  <p className="text-sm font-bold text-on-surface mb-2">{activeData.label}</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-on-surface-variant">
                        <span className="h-2 w-2 rounded-full bg-primary-container" />
                        تم التأكيد
                      </span>
                      <span className="font-bold text-primary tabular-nums">{activeData.confirmed}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-on-surface-variant">
                        <span className="h-2 w-2 rounded-full bg-tertiary" />
                        اعتذر
                      </span>
                      <span className="font-bold text-tertiary tabular-nums">{activeData.declined}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-outline-variant/15 flex justify-between text-[10px]">
                      <span className="text-outline">الإجمالي</span>
                      <span className="font-bold text-on-surface tabular-nums">{activeData.total}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto pb-2 scrollbar-thin">
            <div className="relative min-w-[720px] pt-16 sm:pt-14">
              {/* grid lines */}
              <div className="absolute inset-x-0 bottom-7 top-0 flex flex-col justify-between pointer-events-none">
                {gridLines.map((line) => (
                  <div key={line} className="flex items-center gap-2">
                    <div className="flex-1 border-t border-dashed border-outline-variant/15" />
                  </div>
                ))}
              </div>

              <div className="relative flex h-[220px] sm:h-[260px] lg:h-[280px] items-end justify-between gap-1 sm:gap-2 px-1">
                {chart.labels.map((label, i) => {
                  const confirmed = chart.confirmed[i];
                  const declined = chart.declined[i];
                  const confirmedH = pct(confirmed, stats.maxBar);
                  const declinedH = pct(declined, stats.maxBar);
                  const isActive = activeIndex === i;
                  const isCurrentMonth = i === stats.currentMonthIdx;
                  const isPeak = i === stats.peakIdx && stats.peakVal > 0;

                  return (
                    <motion.button
                      key={`${label}-${i}`}
                      type="button"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: "easeOut" }}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => setPinnedIndex(pinnedIndex === i ? null : i)}
                      className={`group relative flex flex-1 flex-col items-center gap-2 h-full min-w-0 rounded-t-xl transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        isActive ? "z-10" : ""
                      }`}
                      aria-label={`${label}: ${confirmed} مؤكد، ${declined} اعتذر`}
                    >
                      {/* peak / current badges */}
                      {isPeak && !isActive && (
                        <span className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-bold text-amber-400/80">
                          ★
                        </span>
                      )}
                      {isCurrentMonth && (
                        <span
                          className={`absolute top-0 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${
                            isActive ? "bg-primary shadow-[0_0_8px_#5b2eff]" : "bg-primary/50"
                          }`}
                        />
                      )}

                      <div
                        className={`relative flex w-full gap-0.5 sm:gap-1 items-end h-full rounded-t-xl transition-all duration-300 ${
                          isActive
                            ? "bg-primary-container/5 ring-1 ring-primary-container/30"
                            : "group-hover:bg-surface-container-high/30"
                        }`}
                      >
                        {/* confirmed bar */}
                        <div className="relative flex-1 h-full overflow-hidden rounded-t-lg bg-primary-container/10">
                          <motion.div
                            className={`absolute bottom-0 w-full rounded-t-lg ${
                              isActive || isPeak
                                ? "bg-gradient-to-t from-primary-container via-[#7c4dff] to-primary shadow-[0_0_24px_rgba(91,46,255,0.45)]"
                                : "bg-gradient-to-t from-primary-container/80 to-primary/90 group-hover:from-primary-container group-hover:to-primary"
                            }`}
                            initial={{ height: 0 }}
                            animate={{ height: `${confirmedH}%` }}
                            transition={{ delay: i * 0.04 + 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          />
                          {isActive && confirmed > 0 && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white drop-shadow"
                            >
                              {confirmed}
                            </motion.span>
                          )}
                        </div>

                        {/* declined bar */}
                        <div className="relative flex-1 h-full overflow-hidden rounded-t-lg bg-tertiary/10">
                          <motion.div
                            className={`absolute bottom-0 w-full rounded-t-lg ${
                              isActive
                                ? "bg-gradient-to-t from-tertiary-container via-tertiary to-[#ffd4c4] shadow-[0_0_20px_rgba(255,181,155,0.4)]"
                                : "bg-gradient-to-t from-tertiary-container/80 to-tertiary/90 group-hover:from-tertiary-container group-hover:to-tertiary"
                            }`}
                            initial={{ height: 0 }}
                            animate={{ height: `${declinedH}%` }}
                            transition={{ delay: i * 0.04 + 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                          />
                          {isActive && declined > 0 && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-on-tertiary drop-shadow"
                            >
                              {declined}
                            </motion.span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`w-full truncate text-center text-[9px] sm:text-[10px] font-bold transition-colors ${
                          isActive
                            ? "text-primary"
                            : isCurrentMonth
                              ? "text-primary/70"
                              : "text-on-surface-variant group-hover:text-on-surface"
                        }`}
                      >
                        {label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
