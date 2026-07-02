import EventManagerEventHub from "@/components/event-manager-panel/EventManagerEventHub";

export default function EventManagerBroadcastHubPage() {
  return (
    <EventManagerEventHub
      title="البث المباشر"
      description="اختر المناسبة لتشغيل صوت أو فيديو أو يوتيوب للضيوف في رابط الدعوة"
      icon="podcasts"
      suffix="broadcast"
      basePath="/event-manager/events"
    />
  );
}
