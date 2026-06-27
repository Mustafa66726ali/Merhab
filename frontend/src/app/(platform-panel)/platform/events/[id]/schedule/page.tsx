import EventScheduleView from "@/components/platform-panel/schedule/EventScheduleView";

export default async function PlatformEventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EventScheduleView
      eventId={Number(id)}
      eventsBasePath="/platform/events"
      canManage={false}
    />
  );
}
