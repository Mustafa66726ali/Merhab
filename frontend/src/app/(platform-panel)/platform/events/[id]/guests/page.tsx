import PlatformEventGuestsView from "@/components/platform-panel/PlatformEventGuestsView";

export default function PlatformEventGuestsPage({
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
  return <PlatformEventGuestsView eventId={eventId} />;
}
