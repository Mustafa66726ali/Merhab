"use client";

import { useMemo, useState } from "react";
import EventCoverImage from "@/components/common/EventCoverImage";
import type { EventBrief, EventListItem } from "@/lib/api";
import { highlightMatch } from "./HighlightText";
import { eventStatusClass } from "./eventStatus";

const STATUS_OPTIONS = [
  { value: "", label: "كل الحالات" },
  { value: "active", label: "نشط" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
  { value: "archived", label: "مؤرشف" },
  { value: "draft", label: "مسودة" },
];

export default function EventsTableSection({
  events,
  showPlatform = true,
}: {
  events: EventListItem[];
  showPlatform?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      if (statusFilter && ev.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        String(ev.id),
        ev.title,
        ev.platform_name,
        ev.manager_name,
        ev.status_label,
        ev.venue,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [events, search, statusFilter]);

  return (
    <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-bold text-on-surface sm:text-xl">قائمة الفعاليات</h3>
          <p className="text-sm text-on-surface-variant">
            {filtered.length} من {events.length} فعالية
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:min-w-[240px]">
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg">
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
            className="input-field sm:w-40"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right min-w-[800px]">
          <thead>
            <tr className="text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">
              <th className="pb-4 px-3">ID</th>
              <th className="pb-4 px-3">اسم الفعالية</th>
              {showPlatform && <th className="pb-4 px-3">المنصة</th>}
              <th className="pb-4 px-3">مدير الفعالية</th>
              <th className="pb-4 px-3">الحالة</th>
              <th className="pb-4 px-3 text-center">المدعوين</th>
              <th className="pb-4 px-3">تاريخ الإضافة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/5">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={showPlatform ? 7 : 6} className="py-12 text-center text-on-surface-variant">
                  لا توجد نتائج مطابقة
                </td>
              </tr>
            ) : (
              filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="py-3 px-3 text-xs font-mono text-outline">
                    {highlightMatch(String(ev.id), search)}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-outline-variant/10">
                        <EventCoverImage
                          coverImage={ev.cover_image}
                          alt={ev.title}
                          variant="thumb"
                        />
                      </div>
                      <span className="font-bold text-sm text-on-surface">
                        {highlightMatch(ev.title, search)}
                      </span>
                    </div>
                  </td>
                  {showPlatform && (
                    <td className="py-3 px-3 text-sm text-on-surface-variant">
                      {highlightMatch(ev.platform_name, search)}
                    </td>
                  )}
                  <td className="py-3 px-3 text-sm text-on-surface-variant">
                    {highlightMatch(ev.manager_name, search)}
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${eventStatusClass(ev.status)}`}>
                      {ev.status_label}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-sm font-bold tabular-nums">{ev.guests_count}</td>
                  <td className="py-3 px-3 text-xs text-on-surface-variant">
                    {new Date(ev.created_at).toLocaleDateString("ar-SA")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function EventMiniCards({
  title,
  events,
  icon,
  accent = "primary",
}: {
  title: string;
  events: EventBrief[];
  icon: string;
  accent?: "primary" | "tertiary";
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className={`material-symbols-outlined ${accent === "tertiary" ? "text-tertiary" : "text-primary"}`}>
          {icon}
        </span>
        <h4 className="font-bold text-on-surface text-sm sm:text-base">{title}</h4>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-on-surface-variant py-4 text-center">لا توجد بيانات</p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev, i) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container/50 border border-outline-variant/5 hover:border-primary-container/20 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-bold text-outline w-5">{i + 1}</span>
                <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-outline-variant/10">
                  <EventCoverImage coverImage={ev.cover_image} alt={ev.title} variant="thumb" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-on-surface truncate">{ev.title}</p>
                  <p className="text-[10px] text-on-surface-variant truncate">{ev.platform_name}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-emerald-400">{ev.attended_count} حضور</p>
                <p className="text-[10px] text-outline">{ev.guests_count} مدعو</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
