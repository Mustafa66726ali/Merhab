"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MessageStatusTags,
} from "@/components/comms/MessageStatusBadges";
import {
  commsAPI,
  type DirectMessage,
  type MessageContact,
} from "@/lib/api";

type BoxTab = "inbox" | "outbox" | "all";
type ReadFilter = "all" | "read" | "unread";
type DeliveryFilter = "all" | "delivered" | "pending" | "failed";

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

function buildListFilters(
  tab: BoxTab,
  readFilter: ReadFilter,
  deliveryFilter: DeliveryFilter
) {
  const filters: {
    is_read?: "true" | "false";
    delivery_status?: "pending" | "delivered" | "failed";
    opened?: "true" | "false";
  } = {};

  if (deliveryFilter !== "all") {
    filters.delivery_status = deliveryFilter;
  }

  if (readFilter === "read") {
    if (tab === "outbox") filters.opened = "true";
    else filters.is_read = "true";
  } else if (readFilter === "unread") {
    if (tab === "outbox") filters.opened = "false";
    else filters.is_read = "false";
  } else if (tab === "all") {
    /* no read filter */
  }

  return filters;
}

interface MessagesViewProps {
  scopeLabel: string;
}

export default function MessagesView({ scopeLabel }: MessagesViewProps) {
  const searchParams = useSearchParams();
  const initialId = searchParams.get("id");
  const initialBox = searchParams.get("box");
  const initialRead = searchParams.get("read");

  const [tab, setTab] = useState<BoxTab>(() => {
    if (initialBox === "inbox" || initialBox === "outbox" || initialBox === "all") {
      return initialBox;
    }
    return "inbox";
  });
  const [readFilter, setReadFilter] = useState<ReadFilter>(() => {
    if (initialRead === "unread") return "unread";
    if (initialRead === "read") return "read";
    return "all";
  });
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inboxUnread, setInboxUnread] = useState(0);
  const [contacts, setContacts] = useState<MessageContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DirectMessage | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState<number | "">("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [deleting, setDeleting] = useState(false);

  const listFilters = useMemo(
    () => buildListFilters(tab, readFilter, deliveryFilter),
    [tab, readFilter, deliveryFilter]
  );

  const load = useCallback(async () => {
    try {
      const [listRes, contactsRes] = await Promise.all([
        commsAPI.messagesList(tab, listFilters),
        commsAPI.messageContacts(),
      ]);
      setMessages(listRes.data.messages);
      setInboxUnread(listRes.data.inbox_unread);
      setContacts(contactsRes.data.contacts);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [tab, listFilters]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!initialId) return;
    const pick = async () => {
      try {
        const res = await commsAPI.messagesList("all");
        const found = res.data.messages.find((m) => String(m.id) === initialId);
        if (found) {
          setSelected(found);
          setTab(found.is_outgoing ? "outbox" : "inbox");
          if (!found.is_read && !found.is_outgoing) {
            const updated = await commsAPI.markMessageRead(found.id);
            setSelected(updated.data);
            load();
          }
        }
      } catch {
        /* ignore */
      }
    };
    pick();
  }, [initialId, load]);

  const selectMessage = async (m: DirectMessage) => {
    setSelected(m);
    setReplyBody("");
    setActionMsg("");
    if (!m.is_read && !m.is_outgoing) {
      try {
        const res = await commsAPI.markMessageRead(m.id);
        setSelected(res.data);
        load();
      } catch {
        /* ignore */
      }
    }
  };

  const handleReply = async () => {
    if (!selected || !replyBody.trim()) return;
    const recipientId = selected.is_outgoing ? selected.recipient : selected.sender;
    setSending(true);
    setActionMsg("");
    try {
      await commsAPI.sendMessage({
        recipient_id: recipientId,
        body: replyBody.trim(),
        parent_id: selected.id,
        subject: selected.subject,
      });
      setReplyBody("");
      setActionMsg("تم إرسال الرد بنجاح");
      setTab("outbox");
      await load();
    } catch {
      setActionMsg("فشل إرسال الرد — تأكد من الاتصال وحاول مجدداً");
    } finally {
      setSending(false);
    }
  };

  const handleCompose = async () => {
    if (!composeRecipient || !composeBody.trim()) return;
    setSending(true);
    setActionMsg("");
    try {
      await commsAPI.sendMessage({
        recipient_id: Number(composeRecipient),
        subject: composeSubject.trim(),
        body: composeBody.trim(),
      });
      setComposeOpen(false);
      setComposeSubject("");
      setComposeBody("");
      setComposeRecipient("");
      setActionMsg("تم إرسال الرسالة");
      setTab("outbox");
      await load();
    } catch {
      setActionMsg("فشل إرسال الرسالة — تأكد من اختيار المستلم والمحتوى");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm("هل تريد حذف هذه الرسالة؟")) return;
    setDeleting(true);
    try {
      await commsAPI.deleteMessage(selected.id);
      setSelected(null);
      setActionMsg("تم حذف الرسالة");
      await load();
    } catch {
      setActionMsg("فشل حذف الرسالة");
    } finally {
      setDeleting(false);
    }
  };

  const contactLabel = (c: MessageContact) => {
    if (c.platform_name) return `${c.name} — ${c.platform_name}`;
    return `${c.name} — ${c.role_label}`;
  };

  const readFilterLabel =
    tab === "outbox" ? "حالة الفتح" : tab === "inbox" ? "حالة القراءة" : "مقروء / غير مقروء";

  if (loading && messages.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface font-headline">الرسائل</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {scopeLabel} — وارد ({inboxUnread} غير مقروء)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setComposeOpen(true);
            setComposeRecipient(contacts[0]?.id ?? "");
          }}
          disabled={contacts.length === 0}
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">edit</span>
          رسالة جديدة
        </button>
      </div>

      {contacts.length === 0 && (
        <p className="text-sm px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
          لا يوجد مستلمين متاحين للمراسلة حالياً.
        </p>
      )}

      {actionMsg && (
        <p className="text-sm px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {actionMsg}
        </p>
      )}

      {/* Box tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["inbox", "outbox", "all"] as BoxTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setSelected(null);
              setReadFilter("all");
            }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t
                ? "bg-primary-container text-on-primary-container"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t === "inbox" ? "الوارد" : t === "outbox" ? "الصادر" : "الكل"}
            {t === "inbox" && inboxUnread > 0 && (
              <span className="mr-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                {inboxUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low">
        <p className="text-xs font-bold text-on-surface-variant">{readFilterLabel}</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: tab === "outbox" ? "كل الرسائل" : "كل الرسائل" },
              {
                id: "read",
                label: tab === "outbox" ? "تم الفتح" : "مقروءة",
              },
              {
                id: "unread",
                label: tab === "outbox" ? "لم يُفتح بعد" : "غير مقروءة",
              },
            ] as { id: ReadFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setReadFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                readFilter === f.id
                  ? "border-primary-container/50 bg-primary-container/15 text-primary"
                  : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-on-surface-variant mt-1">حالة التسليم</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "all", label: "كل التسليم" },
              { id: "delivered", label: "تم التسليم" },
              { id: "pending", label: "قيد الإرسال" },
              { id: "failed", label: "فشل التسليم" },
            ] as { id: DeliveryFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDeliveryFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                deliveryFilter === f.id
                  ? "border-primary-container/50 bg-primary-container/15 text-primary"
                  : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6 min-h-[480px]">
        <div className="lg:col-span-2 bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden flex flex-col max-h-[70vh] lg:max-h-[calc(100vh-280px)]">
          <div className="overflow-y-auto sidebar-scroll flex-1">
            {messages.length === 0 ? (
              <p className="text-center text-on-surface-variant py-16 px-4">لا توجد رسائل</p>
            ) : (
              messages.map((m) => {
                const isOutgoing = m.is_outgoing ?? m.direction === "outgoing";
                const isUnreadIncoming = !isOutgoing && !m.is_read;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => selectMessage(m)}
                    className={`w-full text-right px-4 py-3 border-b border-outline-variant/8 hover:bg-surface-container-high/50 transition-colors ${
                      selected?.id === m.id ? "bg-primary-container/10" : ""
                    } ${isUnreadIncoming ? "border-r-2 border-r-primary/70" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p
                        className={`text-sm truncate ${
                          isUnreadIncoming ? "font-bold text-on-surface" : "font-medium text-on-surface"
                        }`}
                      >
                        {m.subject || "رسالة"}
                      </p>
                      <span className="text-[9px] text-outline shrink-0 tabular-nums">
                        {formatDateTime(m.created_at).split("،").pop()?.trim()}
                      </span>
                    </div>
                    <p
                      className={`text-xs line-clamp-1 ${
                        isUnreadIncoming ? "text-on-surface-variant" : "text-outline"
                      }`}
                    >
                      {m.body}
                    </p>
                    <p className="text-[9px] text-outline mt-1 truncate">
                      {isOutgoing ? `إلى: ${m.recipient_name}` : `من: ${m.sender_name}`}
                      {m.platform_name ? ` · ${m.platform_name}` : ""}
                    </p>
                    <div className="mt-1.5">
                      <MessageStatusTags message={m} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col min-h-[400px] max-h-[70vh] lg:max-h-[calc(100vh-280px)]">
          {selected ? (
            <>
              <div className="p-5 sm:p-6 border-b border-outline-variant/10 shrink-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="text-lg font-bold text-on-surface">{selected.subject}</h2>
                    <p className="text-sm text-on-surface-variant">
                      {selected.is_outgoing
                        ? `إلى: ${selected.recipient_name}`
                        : `من: ${selected.sender_name}`}
                      {selected.platform_name ? ` · ${selected.platform_name}` : ""}
                      <span className="text-outline"> · {formatDateTime(selected.created_at)}</span>
                    </p>
                    <MessageStatusTags message={selected} />
                  </div>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold text-red-400 hover:bg-red-400/10 border border-red-400/20 transition-colors shrink-0"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                    حذف
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto sidebar-scroll p-5 sm:p-6">
                <p className="text-on-surface leading-relaxed whitespace-pre-wrap">{selected.body}</p>
              </div>
              <div className="p-4 sm:p-5 border-t border-outline-variant/10 shrink-0 bg-surface-container/30">
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  الرد على الرسالة
                </label>
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface min-h-[100px] resize-y outline-none focus:ring-2 focus:ring-primary-container/40"
                  placeholder="اكتب ردك هنا..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <div className="flex justify-end mt-3">
                  <button
                    type="button"
                    onClick={handleReply}
                    disabled={sending || !replyBody.trim()}
                    className="inline-flex items-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">send</span>
                    {sending ? "جاري الإرسال..." : "إرسال الرد"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 min-h-[280px] text-on-surface-variant p-6">
              <span className="material-symbols-outlined text-5xl mb-3 opacity-40">mail</span>
              <p>اختر رسالة من القائمة أو أنشئ رسالة جديدة</p>
            </div>
          )}
        </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-surface-container rounded-2xl border border-outline-variant/20 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">رسالة جديدة</h3>
              <button
                type="button"
                onClick={() => setComposeOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5">إلى</label>
              <select
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm"
                value={composeRecipient}
                onChange={(e) => setComposeRecipient(Number(e.target.value) || "")}
              >
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5">الموضوع</label>
              <input
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="موضوع الرسالة"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-on-surface-variant mb-1.5">المحتوى</label>
              <textarea
                className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm min-h-[120px]"
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="اكتب رسالتك..."
              />
            </div>
            <button
              type="button"
              onClick={handleCompose}
              disabled={sending || !composeBody.trim() || !composeRecipient}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {sending ? "جاري الإرسال..." : "إرسال"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
