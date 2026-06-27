import PlatformEventGroupsView from "@/components/platform-panel/PlatformEventGroupsView";

export default function PlatformEventGroupsPage({
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
  return <PlatformEventGroupsView eventId={eventId} />;
}
