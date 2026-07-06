import GuestEditView from "@/components/platform-panel/GuestEditView";

export default async function EventOrganizerGuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestEditView
      guestId={guestId}
      guestsBasePath="/event-organizer/guests"
      eventsBasePath="/event-organizer/events"
    />
  );
}
