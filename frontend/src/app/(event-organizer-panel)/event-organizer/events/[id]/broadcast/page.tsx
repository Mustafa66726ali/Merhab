import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import EventBroadcastManager from "@/components/event-organizer-panel/EventBroadcastManager";

export default async function EventOrganizerBroadcastPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const eventId = Number(id);
  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-5">
      <div className="space-y-2">
        <EventPageHeader
          eventId={eventId}
          currentLabel="البث المباشر"
          eventsBasePath="/event-organizer/events"
        />
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-headline">
            البث للضيوف
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed mt-1">
            شغّل ملفاً صوتياً، أو بثاً من يوتيوب، أو ميكروفون/كاميرا مباشرة — يظهر للضيوف في رابط
            الدعوة فور التفعيل.
          </p>
        </div>
      </div>
      <EventBroadcastManager eventId={eventId} />
    </div>
  );
}
