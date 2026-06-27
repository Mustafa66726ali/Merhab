"use client";

import type { DirectMessage } from "@/lib/api";

type TagTone = "primary" | "tertiary" | "emerald" | "amber" | "rose" | "muted";

const tagTone: Record<TagTone, string> = {
  primary: "text-primary",
  tertiary: "text-tertiary",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-red-400",
  muted: "text-on-surface-variant",
};

function MicroTag({
  icon,
  label,
  tone = "muted",
  fill,
}: {
  icon: string;
  label: string;
  tone?: TagTone;
  fill?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[9px] font-semibold leading-none ${tagTone[tone]}`}
      title={label}
    >
      <span
        className="material-symbols-outlined text-[11px] leading-none"
        style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
      >
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

/** شارات صغيرة داخل الرسالة فقط — بدون بطاقات */
export function MessageStatusTags({ message }: { message: DirectMessage }) {
  const isOutgoing = message.is_outgoing ?? message.direction === "outgoing";
  const delivery = message.delivery_status ?? "delivered";
  const isRead = message.is_read;
  const isOpened = message.is_opened ?? isRead;

  const tags: Array<{ icon: string; label: string; tone: TagTone; fill?: boolean }> = [];

  tags.push({
    icon: isOutgoing ? "send" : "move_to_inbox",
    label: message.direction_label ?? (isOutgoing ? "صادر" : "وارد"),
    tone: isOutgoing ? "tertiary" : "primary",
  });

  if (isOutgoing) {
    tags.push({
      icon: isOpened ? "done_all" : "visibility_off",
      label: isOpened ? "مفتوحة" : "لم يُفتح",
      tone: isOpened ? "emerald" : "amber",
      fill: isOpened,
    });
  } else {
    tags.push({
      icon: isRead ? "done_all" : "markunread",
      label: isRead ? "مقروءة" : "غير مقروءة",
      tone: isRead ? "emerald" : "amber",
      fill: isRead,
    });
  }

  if (delivery === "delivered") {
    tags.push({ icon: "check_circle", label: "وصلت", tone: "emerald", fill: true });
  } else if (delivery === "pending") {
    tags.push({ icon: "schedule_send", label: "قيد الإرسال", tone: "amber" });
  } else if (delivery === "failed") {
    tags.push({ icon: "error", label: "لم تصل", tone: "rose" });
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {tags.map((t) => (
        <MicroTag key={t.label} icon={t.icon} label={t.label} tone={t.tone} fill={t.fill} />
      ))}
    </span>
  );
}
