import PlatformEventProgressView from "@/components/platform-panel/PlatformEventProgressView";

export default function EventManagerEventProgressPage({
  params,
}: {
  params: { id: string };
}) {
  return <PlatformEventProgressView eventId={Number(params.id)} eventsBasePath="/event-manager/events" />;
}
