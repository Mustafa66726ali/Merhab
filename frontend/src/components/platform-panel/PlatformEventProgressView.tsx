"use client";

import { useCallback, useEffect, useState } from "react";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import { EVENT_PHASES, EVENT_PHASE_WEIGHT } from "@/lib/eventPhases";
import { eventsAPI, type EventDetail } from "@/lib/api";

interface PlatformEventProgressViewProps {
  eventId: number;
  eventsBasePath?: string;
}

export default function PlatformEventProgressView({
  eventId,
  eventsBasePath = "/platform/events",
}: PlatformEventProgressViewProps) {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await eventsAPI.get(eventId);
      setEvent(res.data);
      setError("");
    } catch {
      setEvent(null);
      setError("تعذّر تحميل تقدم الفعالية.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center text-on-surface-variant">
        {error || "المناسبة غير موجودة."}
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="space-y-3">
        <EventPageHeader
          eventId={eventId}
          eventTitle={event.title}
          currentLabel="تقدم الفعالية"
          eventsBasePath={eventsBasePath}
        />
        <h1 className="text-2xl sm:text-4xl font-black text-on-surface tracking-tight font-headline">
          تقدم مراحل الفعالية
        </h1>
        <p className="text-on-surface-variant max-w-xl text-sm sm:text-base leading-relaxed">
          نظرة على مراحل إعداد مناسبة «{event.title}». سيتم تطوير تفاصيل التقدم والمهام لاحقاً.
        </p>
      </div>

      <div className="rounded-2xl sm:rounded-3xl border border-outline-variant/10 bg-surface-container-low p-6 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 sm:mb-10">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">
              نسبة الاكتمال
            </p>
            <p className="text-4xl sm:text-5xl font-black text-on-surface tabular-nums">
              {event.completion_percent}%
            </p>
          </div>
          <div className="rounded-xl bg-primary-container/10 border border-primary-container/20 px-4 py-3">
            <p className="text-xs text-on-surface-variant mb-1">المرحلة الحالية</p>
            <p className="font-bold text-primary">{event.phase_label}</p>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-5">
          {EVENT_PHASES.map((phase, index) => {
            const threshold = (index + 1) * EVENT_PHASE_WEIGHT;
            const done = event.completion_percent >= threshold;
            const isCurrent = event.phase === phase.key;

            return (
              <div
                key={phase.key}
                className={`flex items-start gap-4 sm:gap-5 p-4 sm:p-5 rounded-2xl border transition-colors ${
                  isCurrent
                    ? "border-primary-container/40 bg-primary-container/10"
                    : done
                      ? "border-emerald-500/20 bg-emerald-500/5"
                      : "border-outline-variant/10 bg-surface-container-high/30"
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    done
                      ? "bg-emerald-500/15 text-emerald-400"
                      : isCurrent
                        ? "bg-primary-container/20 text-primary"
                        : "bg-surface-container-highest text-outline"
                  }`}
                >
                  <span className="material-symbols-outlined">{phase.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-on-surface">{phase.label}</h3>
                    <span className="text-[10px] font-bold text-on-surface-variant tabular-nums">
                      {EVENT_PHASE_WEIGHT}%
                    </span>
                    {done && (
                      <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10">
                        مكتمل
                      </span>
                    )}
                    {isCurrent && !done && (
                      <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary-container/15">
                        قيد التنفيذ
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden mt-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        done ? "bg-emerald-400" : isCurrent ? "bg-primary-container" : "bg-outline-variant/30"
                      }`}
                      style={{
                        width: `${done
                          ? 100
                          : Math.max(
                              0,
                              Math.min(
                                100,
                                ((event.completion_percent - index * EVENT_PHASE_WEIGHT) /
                                  EVENT_PHASE_WEIGHT) *
                                  100
                              )
                            )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-on-surface-variant text-center sm:text-right border-t border-outline-variant/10 pt-6">
          تفاصيل المهام والإجراءات لكل مرحلة ستُضاف في تحديث لاحق.
        </p>
      </div>
    </div>
  );
}
