import PlatformEventGroupsView from "@/components/platform-panel/PlatformEventGroupsView";

export default function EventManagerEventGroupsPage({
  params,
}: {
  params: { id: string };
}) {
  return <PlatformEventGroupsView eventId={Number(params.id)} eventsBasePath="/event-manager/events" />;
}
