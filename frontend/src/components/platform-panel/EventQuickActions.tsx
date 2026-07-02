import Link from "next/link";

interface EventQuickActionsProps {
  eventId: number;
  eventsBasePath?: string;
}

const actionDefs = [
  {
    key: "guests",
    suffix: "guests",
    icon: "group",
    label: "الضيوف",
    description: "معلومات ضيوف الفعالية",
  },
  {
    key: "progress",
    suffix: "progress",
    icon: "timeline",
    label: "تقدم الفعالية",
    description: "مراحل إعداد المناسبة",
  },
  {
    key: "groups",
    suffix: "groups",
    icon: "grid_view",
    label: "مجموعات وأقسام الفعالية",
    description: "الأقسام والمجموعات والحضور",
  },
  {
    key: "schedule",
    suffix: "schedule",
    icon: "schedule",
    label: "الجدول الزمني",
    description: "أنشطة ومراحل الفعالية بالتوقيت",
  },
  {
    key: "seating",
    suffix: "seating",
    icon: "event_seat",
    label: "توزيع جلوس الفعالية",
    description: "الطاولات والمقاعد والجلوس",
  },
] as const;

const invitationsAction = {
  key: "invitations",
  suffix: "invitations",
  icon: "mail",
  label: "دعوات الفعالية",
  description: "تحرير الدعوة وإرسالها للضيوف",
} as const;

const broadcastAction = {
  key: "broadcast",
  suffix: "broadcast",
  icon: "podcasts",
  label: "البث المباشر",
  description: "صوت أو فيديو أو يوتيوب للضيوف",
} as const;

export default function EventQuickActions({
  eventId,
  eventsBasePath = "/platform/events",
}: EventQuickActionsProps) {
  const showInvitations =
    eventsBasePath.startsWith("/event-manager") ||
    eventsBasePath.startsWith("/event-organizer");
  const actions = showInvitations
    ? [...actionDefs, invitationsAction, broadcastAction]
    : actionDefs;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      {actions.map((action) => (
        <Link
          key={action.key}
          href={`${eventsBasePath}/${eventId}/${action.suffix}`}
          className="group flex items-center gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm p-4 sm:p-5 hover:border-primary-container/35 hover:bg-primary-container/5 transition-all active:scale-[0.98]"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-container/15 flex items-center justify-center shrink-0 group-hover:bg-primary-container/25 transition-colors">
            <span className="material-symbols-outlined text-primary text-2xl">{action.icon}</span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-on-surface text-sm sm:text-base">{action.label}</p>
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">
              {action.description}
            </p>
          </div>
          <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors shrink-0">
            chevron_left
          </span>
        </Link>
      ))}
    </section>
  );
}
