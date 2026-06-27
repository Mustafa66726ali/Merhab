import GuestDetailView from "@/components/platform-panel/GuestDetailView";

export default async function PlatformGuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guestId = Number(id);

  return (
    <GuestDetailView
      guestId={guestId}
      guestsBasePath="/platform/guests"
      eventsBasePath="/platform/events"
    />
  );
}
