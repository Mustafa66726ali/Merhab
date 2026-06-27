import PlatformEventDetailView from "@/components/platform-panel/PlatformEventDetailView";

export default async function EventOrganizerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlatformEventDetailView
      eventId={Number(id)}
      eventsBasePath="/event-organizer/events"
    />
  );
}
