import EventsListDashboard from "@/components/platform-panel/EventsListDashboard";

export default function PlatformEventsView() {
  return (
    <EventsListDashboard
      title="إدارة المناسبات"
      dataSource="platform-events"
      eventsBasePath="/platform/events"
      layout="platform"
      showAddButton
      showEditAction
      showDeleteAction
      errorMessage="تعذّر تحميل فعاليات المنصة."
    />
  );
}
