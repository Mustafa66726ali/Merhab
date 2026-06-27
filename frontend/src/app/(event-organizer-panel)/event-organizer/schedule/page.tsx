import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventOrganizerScheduleHubPage() {
  return (
    <EventManagerEventHub
      title="الجدول الزمني"
      description="اختر المناسبة لعرض جدولها الزمني وأنشطتها"
      icon="schedule"
      suffix="schedule"
      basePath="/event-organizer/events"
    />
  );
}
