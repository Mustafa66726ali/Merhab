import GuestDetailView from "@/components/platform-panel/GuestDetailView";

export default async function EventOrganizerGuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestDetailView
      guestId={guestId}
      guestsBasePath="/event-organizer/guests"
      eventsBasePath="/event-organizer/events"
    />
  );
}
