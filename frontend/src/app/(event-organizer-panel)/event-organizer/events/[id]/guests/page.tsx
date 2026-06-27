import PlatformEventGuestsView from "@/components/platform-panel/PlatformEventGuestsView";

export default async function EventOrganizerEventGuestsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlatformEventGuestsView
      eventId={Number(id)}
      eventsBasePath="/event-organizer/events"
    />
  );
}
