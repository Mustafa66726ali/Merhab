import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function CoordinatorSeatingHubPage() {
  return (
    <EventManagerEventHub
      title="إجلاس الضيوف"
      description="اختر المناسبة لإجلاس الضيوف على المقاعد عبر المسح أو الإدراج"
      icon="event_seat"
      suffix="seating"
      basePath="/coordinator/events"
    />
  );
}
