import EventScheduleView from "@/components/platform-panel/schedule/EventScheduleView";

export default async function EventOrganizerEventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EventScheduleView
      eventId={Number(id)}
      eventsBasePath="/event-organizer/events"
      canManage={false}
    />
  );
}
