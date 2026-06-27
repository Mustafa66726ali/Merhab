"use client";

import EventScheduleView from "@/components/platform-panel/schedule/EventScheduleView";

interface EventManagerScheduleViewProps {
  eventId: number;
}

/** غلاف مدير الفعالية — يمرّر صلاحيات الإدارة إلى المكوّن المشترك */
export default function EventManagerScheduleView({ eventId }: EventManagerScheduleViewProps) {
  return (
    <EventScheduleView
      eventId={eventId}
      eventsBasePath="/event-manager/events"
      canManage
    />
  );
}
