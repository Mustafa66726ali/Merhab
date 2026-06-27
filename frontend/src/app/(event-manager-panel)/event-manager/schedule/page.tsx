import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventManagerScheduleHubPage() {
  return (
    <EventManagerEventHub
      title="الجدول الزمني"
      description="اختر المناسبة لعرض الجدول الزمني والمراحل"
      icon="schedule"
      suffix="schedule"
    />
  );
}
