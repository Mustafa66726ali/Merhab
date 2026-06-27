export function eventStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "completed":
      return "bg-primary-container/10 text-primary border-primary-container/25";
    case "cancelled":
      return "bg-red-500/10 text-red-400 border-red-500/25";
    case "archived":
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/25";
    case "draft":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    default:
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/20";
  }
}

/** شارة الحالة في ترويسة صفحة التفاصيل */
export function eventStatusHeroClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/25";
    case "completed":
      return "bg-primary-container text-on-primary-container shadow-lg shadow-primary-container/25";
    case "cancelled":
      return "bg-red-500/90 text-white shadow-lg shadow-red-500/25";
    case "archived":
      return "bg-surface-container-highest text-on-surface-variant border border-outline-variant/20";
    case "draft":
      return "bg-amber-500/90 text-white shadow-lg shadow-amber-500/25";
    default:
      return "bg-surface-container-high text-on-surface border border-outline-variant/20";
  }
}

export function eventStatusIcon(status: string) {
  switch (status) {
    case "active":
      return "auto_awesome";
    case "completed":
      return "check_circle";
    case "cancelled":
      return "cancel";
    case "archived":
      return "inventory_2";
    case "draft":
      return "edit_note";
    default:
      return "event";
  }
}

export function activityStatusClass(status: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "draft":
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/20";
    case "completed":
      return "bg-primary-container/10 text-primary border-primary-container/20";
    default:
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/20";
  }
}
