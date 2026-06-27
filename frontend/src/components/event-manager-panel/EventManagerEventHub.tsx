"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EventCoverImage from "@/components/common/EventCoverImage";
import { eventsAPI, extractApiList, type EventListItem } from "@/lib/api";

interface EventManagerEventHubProps {
  title: string;
  description: string;
  icon: string;
  suffix: string;
  basePath?: string;
}

export default function EventManagerEventHub({
  title,
  description,
  icon,
  suffix,
  basePath = "/event-manager/events",
}: EventManagerEventHubProps) {
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsAPI
      .list({ page_size: 200 })
      .then((r) => setEvents(extractApiList<EventListItem>(r.data)))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-container/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">{title}</h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">{description}</p>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-center py-16 text-on-surface-variant">لا توجد مناسبات متاحة</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((ev) => (
            <Link
              key={ev.id}
              href={`${basePath}/${ev.id}/${suffix}`}
              className="flex items-center gap-4 p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low hover:border-primary-container/35 transition-all group"
            >
              <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                <EventCoverImage coverImage={ev.cover_image} alt={ev.title} variant="thumb" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
                  {ev.title}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">فتح {title}</p>
              </div>
              <span className="material-symbols-outlined text-outline group-hover:text-primary shrink-0">
                chevron_left
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
