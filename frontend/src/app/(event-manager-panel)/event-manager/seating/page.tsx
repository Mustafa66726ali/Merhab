import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventManagerSeatingHubPage() {
  return (
    <EventManagerEventHub
      title="توزيع المقاعد"
      description="اختر المناسبة لعرض مخطط الجلوس والطاولات"
      icon="event_seat"
      suffix="seating"
    />
  );
}
