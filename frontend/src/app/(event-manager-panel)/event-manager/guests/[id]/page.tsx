import GuestDetailView from "@/components/platform-panel/GuestDetailView";

export default async function EventManagerGuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestDetailView
      guestId={guestId}
      guestsBasePath="/event-manager/guests"
      eventsBasePath="/event-manager/events"
    />
  );
}
