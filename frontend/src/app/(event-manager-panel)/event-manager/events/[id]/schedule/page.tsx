import EventManagerScheduleView from "@/components/event-manager-panel/EventManagerScheduleView";

export default async function EventManagerEventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EventManagerScheduleView eventId={Number(id)} />;
}
