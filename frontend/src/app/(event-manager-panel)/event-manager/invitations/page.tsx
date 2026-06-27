import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventManagerInvitationsHubPage() {
  return (
    <EventManagerEventHub
      title="الدعوات"
      description="اختر المناسبة لتحرير دعواتها وإرسالها للضيوف"
      icon="mail"
      suffix="invitations"
      basePath="/event-manager/events"
    />
  );
}
