export function guestStatusClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "confirmed":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "attended":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "seated":
      return "bg-[#5B2EFF]/15 text-[#b9a7ff] border-[#5B2EFF]/30";
    case "invited":
      return "bg-outline-variant/15 text-outline border-outline-variant/25";
    case "declined":
      return "bg-error/10 text-error border-error/25";
    case "cancelled":
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/25";
    default:
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/20";
  }
}

export function guestStatusDotClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-400";
    case "confirmed":
    case "attended":
      return "bg-emerald-400";
    case "seated":
      return "bg-[#8b6dff]";
    case "invited":
      return "bg-outline";
    case "declined":
      return "bg-error";
    default:
      return "bg-on-surface-variant";
  }
}

export const GUEST_STATUS_OPTIONS = [
  { value: "", label: "جميع الحالات" },
  { value: "pending", label: "جديد" },
  { value: "invited", label: "مدعو" },
  { value: "confirmed", label: "تم التأكيد" },
  { value: "attended", label: "حضر" },
  { value: "seated", label: "جلس في مقعده" },
  { value: "declined", label: "اعتذر عن الحضور" },
  { value: "cancelled", label: "ملغي" },
];
