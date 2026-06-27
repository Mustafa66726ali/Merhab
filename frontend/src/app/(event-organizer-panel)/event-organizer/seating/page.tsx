import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventOrganizerSeatingHubPage() {
  return (
    <EventManagerEventHub
      title="توزيع المقاعد"
      description="اختر المناسبة لإدارة مخططات الجلوس والطاولات والمقاعد"
      icon="event_seat"
      suffix="seating"
      basePath="/event-organizer/events"
    />
  );
}
