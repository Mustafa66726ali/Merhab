import EventsListDashboard from "@/components/platform-panel/EventsListDashboard";

export default function EventManagerEventsView() {
  return (
    <EventsListDashboard
      title="مناسباتي"
      dataSource="member-events"
      eventsBasePath="/event-manager/events"
      layout="event-manager"
      errorMessage="تعذّر تحميل مناسباتك."
    />
  );
}
