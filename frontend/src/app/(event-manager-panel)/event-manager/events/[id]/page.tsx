import PlatformEventDetailView from "@/components/platform-panel/PlatformEventDetailView";

export default async function EventManagerEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlatformEventDetailView
      eventId={Number(id)}
      eventsBasePath="/event-manager/events"
    />
  );
}
