import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import InvitationBuilder from "@/components/invitations/InvitationBuilder";

export default async function EventManagerInvitationsPage({
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
          currentLabel="الدعوات"
          eventsBasePath="/event-manager/events"
        />
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight font-headline">
            دعوات الفعالية
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl leading-relaxed mt-1">
            حرّر نص الدعوة وخصّصه حسب القسم أو المجموعة أو ضيوف محددين، ثم أرسله عبر واتساب.
            يحصل كل ضيف على رابط فريد لتأكيد الحضور أو الاعتذار.
          </p>
        </div>
      </div>
      <InvitationBuilder eventId={eventId} />
    </div>
  );
}
