"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import SeatingPlanCanvas from "@/components/platform-panel/seating/SeatingPlanCanvas";
import { eventsAPI, type EventSeatingOverviewResponse } from "@/lib/api";

interface PlatformEventSeatingViewProps {
  eventId: number;
  eventsBasePath?: string;
}

export default function PlatformEventSeatingView({
  eventId,
  eventsBasePath = "/platform/events",
}: PlatformEventSeatingViewProps) {
  const [data, setData] = useState<EventSeatingOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePlanId, setActivePlanId] = useState<number | null>(null);
  const [guestSearch, setGuestSearch] = useState("");
  const [zoom, setZoom] = useState(1);

  const load = useCallback(async () => {
    try {
      const res = await eventsAPI.seatingOverview(eventId);
      setData(res.data);
      if (res.data.plans.length > 0) {
        setActivePlanId(res.data.plans[0].id);
      }
      setError("");
    } catch {
      setData(null);
      setError("تعذّر تحميل مخطط الجلوس.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const activePlan = useMemo(
    () => data?.plans.find((p) => p.id === activePlanId) ?? data?.plans[0] ?? null,
    [data, activePlanId]
  );

  const filteredUnassigned = useMemo(() => {
    if (!data) return [];
    const q = guestSearch.trim().toLowerCase();
    if (!q) return data.unassigned_guests;
    return data.unassigned_guests.filter((g) =>
      [g.full_name, g.section_name, g.group_name].join(" ").toLowerCase().includes(q)
    );
  }, [data, guestSearch]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center text-on-surface-variant">
        {error}
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-5 sm:space-y-6">
      <div className="space-y-2">
        <EventPageHeader
          eventId={eventId}
          eventTitle={data?.event.title}
          currentLabel="توزيع الجلوس"
          eventsBasePath={eventsBasePath}
        />
        <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-headline">
          توزيع جلوس الفعالية
        </h1>
        <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed">
          عرض مخططات الجلوس والطاولات والكراسي لمناسبة «{data?.event.title}». وضع
          الاستعراض فقط — الإضافة والتعديل من صلاحيات مدير الفعالية.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* تبويبات المخططات — قابلة للتمديد */}
      {data && data.plans.length > 0 && (
        <div className="overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex gap-2 min-w-min">
            {data.plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setActivePlanId(plan.id)}
                className={`shrink-0 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activePlan?.id === plan.id
                    ? "bg-primary-container text-on-primary-container shadow-lg shadow-primary-container/20"
                    : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {plan.name}
                <span className="mr-2 text-xs opacity-70 tabular-nums">({plan.tables.length})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
        {/* جانب الضيوف غير المحددين */}
        <div className="col-span-12 lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="bg-surface-container-low p-4 sm:p-6 rounded-2xl border border-outline-variant/10">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-bold">الضيوف (غير محددين)</h3>
              <span className="bg-primary-container/20 text-primary px-2.5 py-1 rounded-full text-xs font-bold tabular-nums">
                {stats?.unassigned_guests ?? 0}
              </span>
            </div>
            <div className="relative mb-4">
              <input
                type="search"
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
                placeholder="بحث عن ضيف..."
                className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-xl py-3 pr-10 text-sm focus:ring-2 focus:ring-primary/50 placeholder-on-surface-variant/40 outline-none"
              />
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-on-surface-variant/60 text-lg">
                search
              </span>
            </div>
            <div className="space-y-2 max-h-[320px] lg:max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
              {filteredUnassigned.length === 0 ? (
                <p className="text-sm text-on-surface-variant text-center py-6">
                  لا يوجد ضيوف غير محددين
                </p>
              ) : (
                filteredUnassigned.map((guest) => (
                  <div
                    key={guest.id}
                    className="p-3 bg-surface-container-high rounded-xl border border-outline-variant/10 flex items-center gap-3"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                        guest.is_vip
                          ? "bg-tertiary/15 text-tertiary"
                          : "bg-surface-container-highest text-primary"
                      }`}
                    >
                      {guest.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{guest.full_name}</p>
                      <p className="text-[10px] text-on-surface-variant opacity-70 truncate">
                        {[guest.section_name, guest.group_name].filter(Boolean).join(" · ") ||
                          "بدون قسم"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-primary-container/10 p-4 sm:p-6 rounded-2xl border border-primary/10">
            <h4 className="text-sm font-bold text-primary mb-2">إحصائيات الإشغال</h4>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-3xl font-black text-on-surface tracking-tighter tabular-nums">
                {stats?.occupancy_rate ?? 0}%
              </span>
              <span className="text-xs text-on-surface-variant mb-1">تم توزيعهم</span>
            </div>
            <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${stats?.occupancy_rate ?? 0}%` }}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant mt-3 tabular-nums">
              {stats?.assigned_guests ?? 0} من {stats?.total_guests ?? 0} ضيف ·{" "}
              {stats?.occupied_seats ?? 0} مقعد محجوز
            </p>
          </div>
        </div>

        {/* مخطط الجلوس */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          {data && data.plans.length === 0 ? (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low py-20 text-center">
              <span className="material-symbols-outlined text-5xl text-outline/30">event_seat</span>
              <p className="text-on-surface-variant mt-3">لا توجد مخططات جلوس لهذه المناسبة بعد.</p>
              <p className="text-xs text-on-surface-variant/70 mt-1">
                يُضيف مدير الفعالية المخططات والطاولات والكراسي.
              </p>
            </div>
          ) : activePlan ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-on-surface-variant">
                  {activePlan.description || `مخطط: ${activePlan.name}`}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(z + 0.1, 1.4))}
                    className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-lg"
                    title="تكبير"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(z - 0.1, 0.6))}
                    className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-lg"
                    title="تصغير"
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    className="w-10 h-10 bg-surface-container-high rounded-xl flex items-center justify-center hover:bg-primary hover:text-on-primary transition-colors shadow-lg"
                    title="إعادة الحجم"
                  >
                    <span className="material-symbols-outlined">restart_alt</span>
                  </button>
                </div>
              </div>
              <SeatingPlanCanvas plan={activePlan} zoom={zoom} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
