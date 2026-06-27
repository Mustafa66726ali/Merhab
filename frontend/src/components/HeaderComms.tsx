"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commsAPI, type DirectMessage, type UserNotificationItem } from "@/lib/api";

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

interface DropdownPosition {
  top: number;
  right: number;
  width: number;
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
      const width = Math.min(384, window.innerWidth - 16);
      const right = Math.max(8, window.innerWidth - rect.right);
      setPos({
        top: rect.bottom + 8,
        right,
        width,
      });
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
        className="fixed z-[200] bg-surface-container border border-outline-variant/25 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        style={{
          top: pos.top,
          right: pos.right,
          width: pos.width,
          maxHeight: `min(70vh, ${window.innerHeight - pos.top - 16}px)`,
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
      setMsgUnread(mRes.data.unread_count);
      setNotifications(nRes.data.notifications);
      setNotifUnread(nRes.data.unread_count);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
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

  const markNotifRead = async (n: UserNotificationItem) => {
    if (!n.is_read) {
      try {
        await commsAPI.markNotificationsRead([n.id]);
        load();
      } catch {
        /* ignore */
      }
    }
  };

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
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#5b2eff] text-white text-[10px] font-bold">
              {msgUnread > 99 ? "99+" : msgUnread}
            </span>
          )}
        </button>
        <DropdownPanel
          open={showMessages}
          anchorRef={msgBtnRef}
          onClose={() => setShowMessages(false)}
        >
          <div className="px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center gap-2 bg-surface-container-high/50">
            <span className="text-sm font-bold text-on-surface">رسائل غير مقروءة</span>
            {msgUnread > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary-container/15 px-2 py-0.5 rounded-full shrink-0">
                {msgUnread} غير مقروءة
              </span>
            )}
          </div>
          <div className="overflow-y-auto sidebar-scroll max-h-[min(50vh,320px)]">
            {unreadMessages.length === 0 ? (
              <p className="text-center text-sm text-on-surface-variant py-10 px-4">
                لا توجد رسائل غير مقروءة
              </p>
            ) : (
              unreadMessages.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => openMessage(m)}
                  className={`w-full text-right px-4 py-3 border-b border-outline-variant/5 hover:bg-surface-container-high/60 transition-colors ${
                    !m.is_read && !m.is_outgoing ? "bg-primary-container/8" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-on-surface truncate flex-1">
                      {m.subject || "رسالة"}
                    </p>
                    {m.is_outgoing && (
                      <span className="text-[9px] font-bold text-outline shrink-0">صادر</span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{m.body}</p>
                  <p className="text-[10px] text-outline mt-1">
                    {m.is_outgoing ? `إلى ${m.recipient_name}` : `من ${m.sender_name}`} ·{" "}
                    {formatTime(m.created_at)}
                  </p>
                </button>
              ))
            )}
          </div>
          {messagesHref && (
            <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container-low/80">
              <Link
                href={`${messagesHref}?box=inbox&read=unread`}
                onClick={() => setShowMessages(false)}
                className="flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                عرض كل الرسائل غير المقروءة
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
            <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-[#ff4444] text-white text-[10px] font-bold shadow-lg shadow-red-500/40">
              {notifUnread > 99 ? "99+" : notifUnread}
            </span>
          )}
        </button>
        <DropdownPanel
          open={showNotifications}
          anchorRef={notifBtnRef}
          onClose={() => setShowNotifications(false)}
        >
          <div className="px-4 py-3 border-b border-outline-variant/10 flex justify-between items-center gap-2 bg-surface-container-high/50">
            <span className="text-sm font-bold text-on-surface">الإشعارات</span>
            {notifUnread > 0 && (
              <span className="text-[10px] font-bold text-primary bg-primary-container/15 px-2 py-0.5 rounded-full shrink-0">
                {notifUnread} جديد
              </span>
            )}
          </div>
          <div className="overflow-y-auto sidebar-scroll max-h-[min(50vh,320px)]">
            {notifications.length === 0 ? (
              <p className="text-center text-sm text-on-surface-variant py-10 px-4">
                لا توجد إشعارات
              </p>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markNotifRead(n)}
                  className={`w-full text-right px-4 py-3 border-b border-outline-variant/5 hover:bg-surface-container-high/60 transition-colors ${
                    !n.is_read ? "bg-primary-container/8" : ""
                  }`}
                >
                  <p className="text-sm font-bold text-on-surface">{n.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-outline mt-1">{formatTime(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
          {notificationsHref && (
            <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container-low/80 flex gap-2">
              <Link
                href={notificationsHref}
                onClick={() => setShowNotifications(false)}
                className="flex-1 flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                عرض كل الإشعارات
              </Link>
            </div>
          )}
        </DropdownPanel>
      </div>
    </>
  );
}
