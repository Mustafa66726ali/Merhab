"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  commsAPI,
  type DirectMessage,
  type GuestMessageItem,
  type UserNotificationItem,
} from "@/lib/api";

const POLL_MS = 10000;

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

const NOTIF_KIND_COLORS: Record<string, string> = {
  event_created: "text-violet-400",
  event_started: "text-emerald-400",
  event_ended: "text-slate-400",
  preparation_complete: "text-sky-400",
  rsvp_started: "text-cyan-400",
  rsvp_confirmed: "text-green-400",
  rsvp_declined: "text-amber-400",
  checkin_started: "text-indigo-400",
  guest_checked_in: "text-teal-400",
  seating_started: "text-fuchsia-400",
  seating_full: "text-pink-400",
  team_assigned: "text-blue-400",
  direct_message: "text-primary",
  system: "text-orange-400",
};

interface DropdownPosition {
  top: number;
  right: number;
  width: number;
  maxHeight: number;
}

function useDropdownPosition(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement | null>
) {
  const [pos, setPos] = useState<DropdownPosition | null>(null);

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 8;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // على الجوال: عرض شبه كامل مع هوامش؛ على الشاشات الأوسع: حتى 400px بمحاذاة الزر
      const width = Math.min(400, vw - margin * 2);
      let right: number;
      if (vw < 640) {
        right = margin;
      } else {
        right = vw - rect.right;
        const maxRight = Math.max(margin, vw - width - margin);
        right = Math.min(Math.max(right, margin), maxRight);
      }

      let top = rect.bottom + 8;
      const spaceBelow = vh - top - margin;
      const spaceAbove = rect.top - margin;
      let maxHeight = Math.min(vh * 0.72, Math.max(spaceBelow, 160));
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        maxHeight = Math.min(vh * 0.72, Math.max(spaceAbove - 8, 160));
        top = Math.max(margin, rect.top - maxHeight - 8);
      } else {
        top = Math.min(top, Math.max(margin, vh - maxHeight - margin));
      }

      setPos({ top, right, width, maxHeight });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  return pos;
}

function DropdownPanel({
  open,
  anchorRef,
  onClose,
  children,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const pos = useDropdownPosition(open, anchorRef);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[190]" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed z-[200] flex flex-col bg-surface-container/95 backdrop-blur-xl border border-outline-variant/25 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden max-w-[calc(100vw-1rem)]"
        style={{
          top: pos.top,
          right: pos.right,
          width: pos.width,
          maxHeight: pos.maxHeight,
        }}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>,
    document.body
  );
}

interface HeaderCommsProps {
  messagesHref?: string;
  notificationsHref?: string;
}

export default function HeaderComms({
  messagesHref,
  notificationsHref,
}: HeaderCommsProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [guestMessages, setGuestMessages] = useState<GuestMessageItem[]>([]);
  const [notifications, setNotifications] = useState<UserNotificationItem[]>([]);
  const [msgUnread, setMsgUnread] = useState(0);
  const [notifUnread, setNotifUnread] = useState(0);
  const [showMessages, setShowMessages] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const msgBtnRef = useRef<HTMLDivElement>(null);
  const notifBtnRef = useRef<HTMLDivElement>(null);

  const unreadMessages = useMemo(
    () => messages.filter((m) => !m.is_read && !m.is_outgoing),
    [messages]
  );

  const load = useCallback(async () => {
    try {
      const [mRes, nRes] = await Promise.all([
        commsAPI.messagesInbox(),
        commsAPI.notificationsInbox(),
      ]);
      setMessages(mRes.data.messages);
      setGuestMessages(mRes.data.guest_messages || []);
      setMsgUnread(mRes.data.unread_count);
      setNotifications(nRes.data.notifications);
      setNotifUnread(nRes.data.unread_count);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const openMessage = async (m: DirectMessage) => {
    if (!m.is_read && !m.is_outgoing) {
      try {
        await commsAPI.markMessageRead(m.id);
        load();
      } catch {
        /* ignore */
      }
    }
    setShowMessages(false);
    if (messagesHref) {
      router.push(`${messagesHref}?id=${m.id}`);
    }
  };

  const openGuestMessage = async (m: GuestMessageItem) => {
    if (!m.is_read) {
      try {
        await commsAPI.markGuestMessagesRead([m.id]);
        load();
      } catch {
        /* ignore */
      }
    }
    setShowMessages(false);
    if (messagesHref) {
      const tab = m.kind === "inquiry" ? "inquiries" : "gratitudes";
      router.push(`${messagesHref}?tab=${tab}`);
    }
  };

  const openNotification = async (n: UserNotificationItem) => {
    if (!n.is_read) {
      try {
        await commsAPI.markNotificationsRead([n.id]);
        load();
      } catch {
        /* ignore */
      }
    }
    setShowNotifications(false);
    if (n.action_path) {
      router.push(n.action_path);
    } else if (notificationsHref) {
      router.push(notificationsHref);
    }
  };

  const hasMessageItems = unreadMessages.length > 0 || guestMessages.length > 0;

  return (
    <>
      <div className="relative shrink-0" ref={msgBtnRef}>
        <button
          type="button"
          onClick={() => {
            setShowMessages((v) => !v);
            setShowNotifications(false);
          }}
          className="relative p-2 sm:p-2.5 text-[#c9c3da] hover:text-primary hover:bg-primary-container/10 transition-all rounded-full"
          title="الرسائل"
          aria-expanded={showMessages}
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl">mail</span>
          {msgUnread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#5b2eff] text-white text-[10px] font-bold animate-pulse">
              {msgUnread > 99 ? "99+" : msgUnread}
            </span>
          )}
        </button>
        <DropdownPanel
          open={showMessages}
          anchorRef={msgBtnRef}
          onClose={() => setShowMessages(false)}
        >
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-outline-variant/10 flex justify-between items-center gap-2 bg-gradient-to-l from-primary/10 to-transparent shrink-0">
            <span className="text-sm font-bold text-on-surface">الرسائل</span>
            {msgUnread > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary-container/15 px-2 py-0.5 rounded-full shrink-0">
                {msgUnread} غير مقروءة
              </span>
            )}
          </div>
          <div className="overflow-y-auto sidebar-scroll flex-1 min-h-0 overscroll-contain">
            {!hasMessageItems ? (
              <p className="text-center text-sm text-on-surface-variant py-8 sm:py-10 px-4">
                لا توجد رسائل جديدة
              </p>
            ) : (
              <>
                {guestMessages.map((m) => (
                  <button
                    key={`g-${m.id}`}
                    type="button"
                    onClick={() => openGuestMessage(m)}
                    className="w-full text-right px-3 sm:px-4 py-2.5 sm:py-3 border-b border-outline-variant/5 hover:bg-surface-container-high/60 transition-colors bg-emerald-500/5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-fuchsia-400 shrink-0 mt-0.5">
                        {m.kind === "inquiry" ? "help" : "celebration"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {m.kind === "inquiry" ? "استفسار" : "تهنئة"} — {m.guest_name}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 break-words">
                          {m.content}
                        </p>
                        <p className="text-[10px] text-outline mt-1">{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {unreadMessages.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openMessage(m)}
                    className="w-full text-right px-3 sm:px-4 py-2.5 sm:py-3 border-b border-outline-variant/5 hover:bg-surface-container-high/60 transition-colors bg-primary-container/5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-base text-primary shrink-0 mt-0.5">
                        forward_to_inbox
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {m.subject || "رسالة"}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 break-words">
                          {m.body}
                        </p>
                        <p className="text-[10px] text-outline mt-1 truncate">
                          {m.is_outgoing ? `إلى ${m.recipient_name}` : `من ${m.sender_name}`} ·{" "}
                          {formatTime(m.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
          {messagesHref && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-outline-variant/10 bg-surface-container-low/80 shrink-0">
              <Link
                href={`${messagesHref}?tab=gratitudes`}
                onClick={() => setShowMessages(false)}
                className="flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                عرض كل الرسائل والتهنئات
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </Link>
            </div>
          )}
        </DropdownPanel>
      </div>

      <div className="relative shrink-0" ref={notifBtnRef}>
        <button
          type="button"
          onClick={() => {
            setShowNotifications((v) => !v);
            setShowMessages(false);
          }}
          className="relative p-2 sm:p-2.5 text-[#c9c3da] hover:text-primary hover:bg-primary-container/10 transition-all rounded-full"
          title="الإشعارات"
          aria-expanded={showNotifications}
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl">notifications</span>
          {notifUnread > 0 && (
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ff4444] text-white text-[10px] font-bold shadow-lg shadow-red-500/40 animate-pulse">
              {notifUnread > 99 ? "99+" : notifUnread}
            </span>
          )}
        </button>
        <DropdownPanel
          open={showNotifications}
          anchorRef={notifBtnRef}
          onClose={() => setShowNotifications(false)}
        >
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-outline-variant/10 flex justify-between items-center gap-2 bg-gradient-to-l from-red-500/10 to-transparent shrink-0">
            <span className="text-sm font-bold text-on-surface truncate">إشعارات النظام</span>
            {notifUnread > 0 && (
              <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full shrink-0">
                {notifUnread} جديد
              </span>
            )}
          </div>
          <div className="overflow-y-auto sidebar-scroll flex-1 min-h-0 overscroll-contain">
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-on-surface-variant py-8 sm:py-10 px-4">
                لا توجد إشعارات
              </p>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={`w-full text-right px-3 sm:px-4 py-2.5 sm:py-3 border-b border-outline-variant/5 hover:bg-surface-container-high/60 transition-colors ${
                    !n.is_read ? "bg-primary-container/8" : ""
                  }`}
                >
                  <div className="flex items-start gap-2 sm:gap-2.5">
                    <span
                      className={`material-symbols-outlined text-base sm:text-lg shrink-0 mt-0.5 ${
                        NOTIF_KIND_COLORS[n.kind || "system"] || "text-primary"
                      }`}
                    >
                      {n.icon || "notifications"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-surface line-clamp-2 break-words">
                        {n.title}
                      </p>
                      {n.kind_label && (
                        <p className="text-[10px] text-primary/80 font-bold mt-0.5 truncate">
                          {n.kind_label}
                        </p>
                      )}
                      <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2 break-words">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-outline mt-1">{formatTime(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-2" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          {notificationsHref && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-t border-outline-variant/10 bg-surface-container-low/80 shrink-0">
              <Link
                href={notificationsHref}
                onClick={() => setShowNotifications(false)}
                className="flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                عرض كل الإشعارات
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </Link>
            </div>
          )}
        </DropdownPanel>
      </div>
    </>
  );
}
