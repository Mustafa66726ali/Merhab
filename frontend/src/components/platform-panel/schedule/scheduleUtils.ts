/**
 * أدوات مساعدة لصفحة الجدول الزمني — تنسيق الأوقات والمواقع والمدد.
 */
import type { EventScheduleItem } from "@/lib/api";

export function parseTimeFromIso(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const match = iso.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : "";
  }
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function formatScheduleClock(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "0 دقيقة";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ساعة و ${m} دقيقة`;
  if (h) return `${h} ساعة`;
  return `${m} دقيقة`;
}

export function scheduleDurationMinutes(item: EventScheduleItem): number {
  const start = new Date(item.start_time).getTime();
  const end = new Date(item.end_time).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export function buildScheduleDateTime(eventDate: string, time: string): string {
  const date = eventDate.slice(0, 10);
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${date}T${normalized}`;
}

export function isGeneralLocation(location: string | null | undefined): boolean {
  return !location || !location.trim();
}

export function locationLabel(location: string | null | undefined): string {
  return isGeneralLocation(location) ? "جميع المواقع" : location!.trim();
}

export function totalScheduledMinutes(items: EventScheduleItem[]): number {
  return items.reduce((sum, item) => sum + scheduleDurationMinutes(item), 0);
}

export function eventWindowMinutes(
  date: string,
  time: string,
  endDate: string | null,
  endTime: string | null
): number {
  const timeNorm = (time || "").slice(0, 5);
  if (!date || !timeNorm) return 0;

  const start = new Date(buildScheduleDateTime(date, timeNorm)).getTime();
  const endDateStr = endDate || date;
  const endTimeNorm = (endTime || "").slice(0, 5);
  // بدون وقت انتهاء مُعرَّف — لا يمكن حساب مدة المناسبة
  if (!endTimeNorm || !endTime) return 0;

  const end = new Date(buildScheduleDateTime(endDateStr, endTimeNorm)).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}

export type ScheduleWindowSource = "event" | "schedule_span" | "none";

export interface ScheduleCoverage {
  plannedMinutes: number;
  windowMinutes: number;
  percent: number | null;
  windowSource: ScheduleWindowSource;
  windowLabel: string;
}

/**
 * نسبة تخطيط الوقت = (مجموع مدد الأنشطة) ÷ (مدة المناسبة من البداية حتى النهاية).
 * إن لم يُحدد وقت انتهاء للمناسبة، تُستخدم مدة الجدول (من بداية المناسبة حتى آخر نشاط).
 */
export function computeScheduleCoverage(
  date: string,
  time: string,
  endDate: string | null,
  endTime: string | null,
  schedules: EventScheduleItem[]
): ScheduleCoverage {
  const plannedMinutes = totalScheduledMinutes(schedules);
  let windowMinutes = eventWindowMinutes(date, time, endDate, endTime);
  let windowSource: ScheduleWindowSource = "event";

  if (windowMinutes <= 0 && schedules.length > 0) {
    const timeNorm = (time || "").slice(0, 5);
    const eventStart = new Date(buildScheduleDateTime(date, timeNorm)).getTime();
    const ends = schedules.map((s) => new Date(s.end_time).getTime()).filter((t) => !Number.isNaN(t));
    if (ends.length > 0 && !Number.isNaN(eventStart)) {
      const maxEnd = Math.max(...ends);
      const span = Math.round((maxEnd - eventStart) / 60000);
      windowMinutes = Math.max(span, plannedMinutes, 1);
      windowSource = "schedule_span";
    }
  }

  if (windowMinutes <= 0) {
    return {
      plannedMinutes,
      windowMinutes: 0,
      percent: plannedMinutes > 0 ? null : 0,
      windowSource: "none",
      windowLabel: "",
    };
  }

  const percent =
    plannedMinutes > 0
      ? Math.min(100, Math.round((plannedMinutes / windowMinutes) * 100))
      : 0;

  return {
    plannedMinutes,
    windowMinutes,
    percent,
    windowSource,
    windowLabel: formatDurationMinutes(windowMinutes),
  };
}
