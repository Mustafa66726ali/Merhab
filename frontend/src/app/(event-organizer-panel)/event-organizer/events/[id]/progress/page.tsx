import PlatformEventProgressView from "@/components/platform-panel/PlatformEventProgressView";

export default async function EventOrganizerEventProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlatformEventProgressView
      eventId={Number(id)}
      eventsBasePath="/event-organizer/events"
    />
  );
}
