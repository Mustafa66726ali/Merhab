import PlatformEventGroupsView from "@/components/platform-panel/PlatformEventGroupsView";

export default async function EventOrganizerEventGroupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PlatformEventGroupsView
      eventId={Number(id)}
      eventsBasePath="/event-organizer/events"
    />
  );
}
