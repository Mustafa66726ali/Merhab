import PlatformEventForm from "@/components/platform-panel/PlatformEventForm";

export default function PlatformEventEditPage({
  params,
}: {
  params: { id: string };
}) {
  const eventId = Number(params.id);
  if (!eventId || Number.isNaN(eventId)) {
    return (
      <div className="py-16 text-center text-on-surface-variant">
        رقم المناسبة غير صالح
      </div>
    );
  }
  return <PlatformEventForm mode="edit" eventId={eventId} />;
}
