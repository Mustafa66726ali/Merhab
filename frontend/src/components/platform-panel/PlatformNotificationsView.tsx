"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { commsAPI, type UserNotificationItem } from "@/lib/api";

const KIND_FILTERS = [
  { id: "all", label: "الكل" },
  { id: "event", label: "الفعاليات" },
  { id: "rsvp", label: "التأكيدات" },
  { id: "operations", label: "التشغيل" },
  { id: "system", label: "النظام" },
];

const KIND_GROUPS: Record<string, string[]> = {
  event: ["event_created", "event_started", "event_ended", "preparation_complete"],
  rsvp: ["rsvp_started", "rsvp_confirmed", "rsvp_declined"],
  operations: [
    "checkin_started",
    "guest_checked_in",
    "seating_started",
    "seating_full",
    "team_assigned",
  ],
  system: ["system", "direct_message"],
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("ar-SA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const KIND_COLORS: Record<string, string> = {
  event_created: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
  event_started: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  event_ended: "from-slate-500/20 to-slate-500/5 border-slate-500/30",
  preparation_complete: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
  rsvp_started: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
  rsvp_confirmed: "from-green-500/20 to-green-500/5 border-green-500/30",
  rsvp_declined: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  checkin_started: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
  guest_checked_in: "from-teal-500/20 to-teal-500/5 border-teal-500/30",
  seating_started: "from-fuchsia-500/20 to-fuchsia-500/5 border-fuchsia-500/30",
  seating_full: "from-pink-500/20 to-pink-500/5 border-pink-500/30",
  team_assigned: "from-blue-500/20 to-blue-500/5 border-blue-500/30",
  direct_message: "from-primary/20 to-primary/5 border-primary/30",
  system: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
};

export default function PlatformNotificationsView() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await commsAPI.notificationsList();
      setNotifications(res.data.notifications);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return notifications;
    const kinds = KIND_GROUPS[filter] || [];
    return notifications.filter((n) => kinds.includes(n.kind || "system"));
  }, [notifications, filter]);

  const unread = notifications.filter((n) => !n.is_read).length;

  const openNotification = async (n: UserNotificationItem) => {
    if (!n.is_read) {
      try {
        await commsAPI.markNotificationsRead([n.id]);
        load();
      } catch {
        /* ignore */
      }
    }
    if (n.action_path) router.push(n.action_path);
  };

  const markAllRead = async () => {
    try {
      await commsAPI.markAllNotificationsRead();
      load();
    } catch {
      /* ignore */
    }
  };

  const deleteOne = async (id: number) => {
    if (!window.confirm("حذف هذا الإشعار؟")) return;
    setDeletingId(id);
    try {
      await commsAPI.deleteNotification(id);
      load();
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  };

  const deleteRead = async () => {
    if (!window.confirm("حذف جميع الإشعارات المقروءة؟")) return;
    try {
      await commsAPI.deleteReadNotifications();
      load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4 max-w-4xl mx-auto">
      <div className="rounded-3xl p-6 border border-outline-variant/15 bg-gradient-to-l from-red-500/10 via-primary/5 to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-red-400">notifications_active</span>
              مركز الإشعارات
            </h1>
            <p className="text-sm text-on-surface-variant mt-2">
              تنبيهات الفعاليات والتشغيل والتأكيدات — تُحدَّث تلقائياً كل 10 ثوانٍ
            </p>
          </div>
          {unread > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/15 text-red-300 text-sm font-bold border border-red-500/25">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {unread} غير مقروء
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {KIND_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              filter === f.id
                ? "bg-primary text-on-primary shadow-lg shadow-primary/25"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/15"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25"
          >
            تحديد الكل كمقروء
          </button>
        )}
        <button
          type="button"
          onClick={deleteRead}
          className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant/15 hover:text-on-surface"
        >
          حذف المقروء
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low">
          <span className="material-symbols-outlined text-5xl text-outline mb-3">notifications_off</span>
          <p className="text-on-surface-variant">لا توجد إشعارات في هذا التصنيف</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const cardStyle =
              KIND_COLORS[n.kind || "system"] ||
              "from-primary/15 to-primary/5 border-primary/20";
            return (
              <article
                key={n.id}
                className={`rounded-2xl border bg-gradient-to-l p-4 sm:p-5 transition-all hover:scale-[1.01] cursor-pointer ${cardStyle} ${
                  !n.is_read ? "ring-1 ring-primary/30" : "opacity-90"
                }`}
                onClick={() => openNotification(n)}
                onKeyDown={(e) => e.key === "Enter" && openNotification(n)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-surface-container/80 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-2xl text-primary">
                      {n.icon || "notifications"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="font-bold text-on-surface">{n.title}</h2>
                      {!n.is_read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300">
                          جديد
                        </span>
                      )}
                    </div>
                    {n.kind_label && (
                      <p className="text-xs font-bold text-primary/90 mb-1">{n.kind_label}</p>
                    )}
                    {n.event_title && (
                      <p className="text-xs text-on-surface-variant mb-1">
                        <span className="material-symbols-outlined text-xs align-middle">event</span>{" "}
                        {n.event_title}
                      </p>
                    )}
                    <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[11px] text-outline mt-2">{formatDateTime(n.created_at)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteOne(n.id);
                    }}
                    disabled={deletingId === n.id}
                    className="p-2 rounded-lg text-outline hover:text-red-400 hover:bg-red-400/10 shrink-0"
                    title="حذف"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
                {n.action_path && (
                  <p className="text-xs text-primary mt-3 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    اضغط للانتقال
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-outline">
        التهنئات واستفسارات الضيوف تظهر في أيقونة الرسائل 📬 وليس في مركز الإشعارات
      </p>
    </div>
  );
}
