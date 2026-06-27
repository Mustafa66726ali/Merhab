import EventSeatingManager from "@/components/platform-panel/seating/EventSeatingManager";

export default async function CoordinatorEventSeatingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EventSeatingManager
      eventId={Number(id)}
      eventsBasePath="/coordinator/events"
      canManage
    />
  );
}
