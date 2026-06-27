"use client";

import { formatDurationMinutes, type ScheduleWindowSource } from "./scheduleUtils";

interface EventScheduleStatsProps {
  activitiesCount: number;
  plannedMinutes: number;
  plannedPercent: number | null;
  windowMinutes: number;
  windowLabel: string;
  windowSource: ScheduleWindowSource;
}

export default function EventScheduleStats({
  activitiesCount,
  plannedMinutes,
  plannedPercent,
  windowMinutes,
  windowLabel,
  windowSource,
}: EventScheduleStatsProps) {
  const coverageDisplay =
    plannedPercent === null ? "—" : `${plannedPercent}%`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3">
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm p-4 sm:p-5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            الأنشطة
          </p>
          <p className="text-2xl sm:text-3xl font-black text-on-surface tabular-nums">
            {activitiesCount}
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm p-4 sm:p-5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">
            المدة المخططة
          </p>
          <p className="text-lg sm:text-xl font-black text-on-surface leading-tight">
            {formatDurationMinutes(plannedMinutes)}
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1">مجموع مدد الأنشطة</p>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm p-4 sm:p-5">
          <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
            تغطية الوقت
          </p>
          <p className="text-2xl font-black text-primary tabular-nums">{coverageDisplay}</p>
          {windowMinutes > 0 && plannedPercent !== null && (
            <div className="mt-3 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-primary to-primary-container transition-all duration-500"
                style={{ width: `${plannedPercent}%` }}
              />
            </div>
          )}
          <p className="text-[10px] text-on-surface-variant mt-2 leading-relaxed">
            {windowSource === "event" && windowLabel
              ? `من بداية المناسبة حتى النهاية (${windowLabel})`
              : windowSource === "schedule_span"
                ? `تقريبية: من بداية المناسبة حتى آخر نشاط (${windowLabel}) — حدّد وقت انتهاء المناسبة لدقة أعلى`
                : plannedMinutes > 0
                  ? "حدّد وقت انتهاء المناسبة في معلومات الفعالية لحساب النسبة"
                  : "نسبة الأنشطة المخططة من الوقت المتاح للمناسبة"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/60 p-4 sm:p-5 text-sm text-on-surface-variant leading-relaxed">
        <p className="font-bold text-on-surface text-sm mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">tips_and_updates</span>
          ما معنى تغطية الوقت؟
        </p>
        تعرض كم من مدة المناسبة (من وقت البداية حتى وقت النهاية) مغطى بأنشطة في الجدول. مثال: مناسبة 4 ساعات وأنشطة مجموعها ساعتان = 50%.
      </div>
    </div>
  );
}
