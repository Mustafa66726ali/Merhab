import PlatformEventSeatingView from "@/components/platform-panel/PlatformEventSeatingView";

export default function PlatformEventSeatingPage({
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
  return <PlatformEventSeatingView eventId={eventId} />;
}
