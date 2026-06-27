"use client";

import { useCallback, useEffect, useState } from "react";
import { commsAPI, type UserNotificationItem } from "@/lib/api";

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function PlatformNotificationsView() {
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [load]);

  const markRead = async (id: number) => {
    try {
      await commsAPI.markNotificationsRead([id]);
      load();
    } catch {
      /* ignore */
    }
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
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">الإشعارات</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : "جميع الإشعارات مقروءة"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface-variant hover:text-primary border border-outline-variant/20"
            >
              تعليم الكل كمقروء
            </button>
          )}
          <button
            type="button"
            onClick={deleteRead}
            className="px-4 py-2 rounded-xl text-sm font-bold text-red-400 hover:bg-red-400/10 border border-red-400/20"
          >
            حذف المقروءة
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 py-16 text-center">
          <span className="material-symbols-outlined text-5xl text-outline/40 mb-4 block">notifications_off</span>
          <p className="text-on-surface-variant">لا توجد إشعارات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`bg-surface-container-low rounded-2xl border p-4 sm:p-5 flex gap-4 ${
                n.is_read ? "border-outline-variant/10" : "border-primary-container/30 bg-primary-container/5"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary">
                  {n.is_read ? "notifications" : "notifications_active"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-on-surface">{n.title}</h3>
                  <span className="text-[10px] text-outline shrink-0">{formatDateTime(n.created_at)}</span>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">{n.body}</p>
                {n.sender_name && (
                  <p className="text-xs text-outline mt-2">من: {n.sender_name}</p>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {!n.is_read && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    مقروء
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteOne(n.id)}
                  disabled={deletingId === n.id}
                  className="text-xs font-bold text-red-400 hover:underline disabled:opacity-50"
                >
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
