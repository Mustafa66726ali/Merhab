/** مراحل المناسبة — كل مرحلة 20% */

export const EVENT_PHASE_WEIGHT = 20;

export const EVENT_PHASES = [
  { key: "setup", label: "إعداد المناسبة", icon: "event" },
  { key: "sections", label: "الأقسام والمجموعات", icon: "grid_view" },
  { key: "guests", label: "إضافة الضيوف", icon: "group" },
  { key: "invites", label: "إرسال الدعوات", icon: "send" },
  { key: "attendance", label: "تأكيد الحضور", icon: "how_to_reg" },
] as const;

export type EventPhaseKey = (typeof EVENT_PHASES)[number]["key"];
