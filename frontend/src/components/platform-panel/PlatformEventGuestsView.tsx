import PlatformGuestsListView from "@/components/platform-panel/PlatformGuestsListView";

interface PlatformEventGuestsViewProps {
  eventId: number;
  eventsBasePath?: string;
}

export default function PlatformEventGuestsView({
  eventId,
  eventsBasePath,
}: PlatformEventGuestsViewProps) {
  return <PlatformGuestsListView eventId={eventId} eventsBasePath={eventsBasePath} />;
}
