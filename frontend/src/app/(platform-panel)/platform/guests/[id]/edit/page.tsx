import GuestEditView from "@/components/platform-panel/GuestEditView";

export default async function PlatformGuestEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestEditView
      guestId={guestId}
      guestsBasePath="/platform/guests"
      eventsBasePath="/platform/events"
    />
  );
}
