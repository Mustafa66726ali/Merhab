import PlatformEventProgressView from "@/components/platform-panel/PlatformEventProgressView";

export default function PlatformEventProgressPage({
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
  return <PlatformEventProgressView eventId={eventId} />;
}
