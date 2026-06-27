"use client";

import { useCallback, useEffect, useState } from "react";
import { highlightMatch } from "@/components/events/HighlightText";
import {
  commsAPI,
  type NotificationStats,
  type UserNotificationItem,
} from "@/lib/api";

const emptyStats: NotificationStats = {
  total: 0,
  unread: 0,
  read: 0,
  today: 0,
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [stats, setStats] = useState<NotificationStats>(emptyStats);
  const [platformOptions, setPlatformOptions] = useState<{ value: string; label: string }[]>([]);
  const [search, setSearch] = useState("");
  const [readFilter, setReadFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (readFilter === "unread") params.is_read = "false";
      if (readFilter === "read") params.is_read = "true";
      if (platformFilter) params.platform = platformFilter;
      if (search.trim()) params.search = search.trim();

      const res = await commsAPI.notificationsList(params);
      setNotifications(res.data.notifications);
      setStats(res.data.stats);
      setPlatformOptions(res.data.platform_options ?? []);
    } catch {
      setNotifications([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }, [readFilter, platformFilter, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await commsAPI.deleteNotification(id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const handleMarkRead = async (id: number) => {
    setActionLoading(true);
    try {
      await commsAPI.markNotificationsRead([id]);
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    try {
      await commsAPI.markAllNotificationsRead();
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteRead = async () => {
    if (!confirm("حذف جميع الإشعارات المقروءة؟")) return;
    setActionLoading(true);
    try {
      await commsAPI.deleteReadNotifications();
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  const kpiCards = [
    { label: "إجمالي الإشعارات", value: stats.total, icon: "notifications", color: "primary" },
    { label: "غير مقروء", value: stats.unread, icon: "mark_email_unread", color: "tertiary" },
    { label: "مقروء", value: stats.read, icon: "done_all", color: "primary" },
    { label: "اليوم", value: stats.today, icon: "today", color: "emerald" },
  ];

  if (loading && notifications.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              notifications
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">الإشعارات</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              إدارة ومراجعة إشعارات النظام والمنصات
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionLoading || stats.unread === 0}
            onClick={handleMarkAllRead}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20 transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">done_all</span>
            تعيين الكل كمقروء
          </button>
          <button
            type="button"
            disabled={actionLoading || stats.read === 0}
            onClick={handleDeleteRead}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-base">delete_sweep</span>
            حذف المقروء
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 relative overflow-hidden hover:border-primary-container/20 transition-colors"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/10 blur-[40px] rounded-full -mr-8 -mt-8" />
            <span className="material-symbols-outlined text-primary text-lg mb-2 block relative z-10">
              {card.icon}
            </span>
            <p className="text-[10px] font-bold text-on-surface-variant relative z-10">{card.label}</p>
            <p className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums relative z-10">
              {card.value.toLocaleString("ar-SA")}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface sm:text-xl">قائمة الإشعارات</h3>
            <p className="text-sm text-on-surface-variant">
              {notifications.length} إشعار
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:flex-wrap">
            <div className="relative flex-1 sm:min-w-[220px]">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في الإشعارات..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value)}
              className="input-field sm:w-36"
            >
              <option value="">كل الإشعارات</option>
              <option value="unread">غير مقروء</option>
              <option value="read">مقروء</option>
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="input-field sm:w-44"
            >
              <option value="">كل المنصات</option>
              {platformOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">notifications_off</span>
            <p className="text-on-surface-variant">لا توجد إشعارات مطابقة</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <article
                key={n.id}
                className={`rounded-xl border p-4 sm:p-5 transition-all ${
                  n.is_read
                    ? "border-outline-variant/10 bg-surface-container/30"
                    : "border-primary-container/25 bg-primary-container/5 shadow-sm shadow-primary-container/10"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      n.is_read ? "bg-surface-container-high" : "bg-primary-container/20"
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined ${
                        n.is_read ? "text-on-surface-variant" : "text-primary"
                      }`}
                      style={n.is_read ? {} : { fontVariationSettings: "'FILL' 1" }}
                    >
                      {n.is_read ? "notifications" : "notifications_active"}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-on-surface text-sm sm:text-base">
                        {highlightMatch(n.title, search)}
                      </h4>
                      {!n.is_read && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff4444]/15 text-red-400 border border-red-500/25">
                          جديد
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                      {highlightMatch(n.body, search)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-outline">
                      <span>من: {highlightMatch(n.sender_name, search)}</span>
                      {n.recipient_name && (
                        <span>إلى: {highlightMatch(n.recipient_name, search)}</span>
                      )}
                      {n.platform_name && n.platform_name !== "" && (
                        <span>المنصة: {highlightMatch(n.platform_name, search)}</span>
                      )}
                      <span>{formatDateTime(n.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                    {!n.is_read && (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => handleMarkRead(n.id)}
                        className="p-2 rounded-lg hover:bg-primary-container/15 text-primary transition-colors"
                        title="تعيين كمقروء"
                      >
                        <span className="material-symbols-outlined text-lg">done</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === n.id}
                      onClick={() => handleDelete(n.id)}
                      className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors disabled:opacity-50"
                      title="حذف"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {deletingId === n.id ? "progress_activity" : "delete"}
                      </span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
