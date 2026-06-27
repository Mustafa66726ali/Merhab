import PlatformEventSeatingView from "@/components/platform-panel/PlatformEventSeatingView";

export default function EventManagerEventSeatingPage({
  params,
}: {
  params: { id: string };
}) {
  return <PlatformEventSeatingView eventId={Number(params.id)} eventsBasePath="/event-manager/events" />;
}
