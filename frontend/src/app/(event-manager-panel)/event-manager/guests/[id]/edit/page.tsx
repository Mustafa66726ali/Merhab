import GuestEditView from "@/components/platform-panel/GuestEditView";

export default async function EventManagerGuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestEditView
      guestId={guestId}
      guestsBasePath="/event-manager/guests"
      eventsBasePath="/event-manager/events"
    />
  );
}
