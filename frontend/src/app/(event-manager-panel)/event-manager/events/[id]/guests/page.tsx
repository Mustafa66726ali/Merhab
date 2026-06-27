import PlatformEventGuestsView from "@/components/platform-panel/PlatformEventGuestsView";

export default function EventManagerEventGuestsPage({
  params,
}: {
  params: { id: string };
}) {
  return <PlatformEventGuestsView eventId={Number(params.id)} eventsBasePath="/event-manager/events" />;
}
