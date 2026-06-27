import EventsListDashboard from "@/components/platform-panel/EventsListDashboard";

export default function EventOrganizerEventsPage() {
  return (
    <EventsListDashboard
      title="فعالياتي ومناسباتي"
      subtitle="المناسبات المرتبطة بحسابك كمنظم — بحث وفلترة وقائمة تفصيلية"
      dataSource="organizer-events"
      eventsBasePath="/event-organizer/events"
      layout="event-manager"
      errorMessage="تعذّر تحميل فعالياتك."
    />
  );
}
