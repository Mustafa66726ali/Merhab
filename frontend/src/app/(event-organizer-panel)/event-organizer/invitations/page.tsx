import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventOrganizerInvitationsHubPage() {
  return (
    <EventManagerEventHub
      title="الدعوات"
      description="اختر المناسبة لتحرير دعواتها وإرسالها للضيوف"
      icon="mail"
      suffix="invitations"
      basePath="/event-organizer/events"
    />
  );
}
