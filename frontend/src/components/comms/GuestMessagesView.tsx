"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commsAPI,
  type GuestMessageContact,
  type GuestMessageItem,
} from "@/lib/api";

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

export default function GuestMessagesView() {
  const [contacts, setContacts] = useState<GuestMessageContact[]>([]);
  const [messages, setMessages] = useState<GuestMessageItem[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  const selectedGuest = useMemo(
    () => contacts.find((c) => c.id === selectedGuestId),
    [contacts, selectedGuestId]
  );

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.event_title.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  const loadContacts = useCallback(async () => {
    const res = await commsAPI.guestMessagesContacts();
    setContacts(res.data.contacts);
    if (!selectedGuestId && res.data.contacts.length > 0) {
      setSelectedGuestId(res.data.contacts[0].id);
    }
  }, [selectedGuestId]);

  const loadMessages = useCallback(async (guestId: number) => {
    const res = await commsAPI.guestMessagesList({ guest: guestId });
    setMessages(res.data.messages);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadContacts()
      .catch(() => setContacts([]))
      .finally(() => setLoading(false));
  }, [loadContacts]);

  useEffect(() => {
    if (!selectedGuestId) {
      setMessages([]);
      return;
    }
    loadMessages(selectedGuestId as number).catch(() => setMessages([]));
  }, [selectedGuestId, loadMessages]);

  const handleSend = async (viaWhatsapp: boolean) => {
    if (!selectedGuestId || !body.trim()) return;
    setSending(true);
    setActionMsg("");
    try {
      const res = await commsAPI.sendGuestMessage({
        guest_id: selectedGuestId as number,
        content: body.trim(),
        via_whatsapp: viaWhatsapp,
      });
      setBody("");
      setMessages((prev) => [res.data, ...prev]);
      if (viaWhatsapp && res.data.whatsapp_url && !res.data.whatsapp_sent) {
        window.open(res.data.whatsapp_url, "_blank", "noopener,noreferrer");
        setActionMsg("تم تسجيل الرسالة — افتح واتساب لإكمال الإرسال");
      } else if (res.data.whatsapp_sent) {
        setActionMsg("تم الإرسال عبر واتساب بنجاح");
      } else {
        setActionMsg("تم تسجيل الرسالة");
      }
    } catch {
      setActionMsg("فشل إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-on-surface">مراسلة الضيوف</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            رسائل داخلية مع إمكانية الإرسال عبر واتساب
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[480px]">
        <div className="lg:col-span-2 bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col max-h-[70vh]">
          <div className="p-4 border-b border-outline-variant/10 space-y-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الرقم أو المناسبة..."
              className="w-full px-4 py-2.5 bg-surface-container-high border border-outline-variant/10 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="flex-1 overflow-y-auto sidebar-scroll p-2 space-y-1">
            {filteredContacts.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                لا يوجد ضيوف للمراسلة
              </p>
            ) : (
              filteredContacts.map((guest) => {
                const active = guest.id === selectedGuestId;
                return (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => setSelectedGuestId(guest.id)}
                    className={`w-full text-left p-3 rounded-xl transition-colors ${
                      active
                        ? "bg-primary/15 border border-primary/30"
                        : "hover:bg-surface-container-high border border-transparent"
                    }`}
                  >
                    <p className="font-bold text-on-surface text-sm truncate">{guest.name}</p>
                    <p className="text-xs text-on-surface-variant truncate">{guest.event_title}</p>
                    {guest.phone ? (
                      <p className="text-xs text-outline mt-1" dir="ltr">{guest.phone}</p>
                    ) : (
                      <p className="text-xs text-red-400/80 mt-1">بدون رقم هاتف</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-surface-container-low rounded-2xl border border-outline-variant/10 flex flex-col min-h-[400px] max-h-[70vh]">
          {selectedGuest ? (
            <>
              <div className="p-5 border-b border-outline-variant/10 shrink-0">
                <h2 className="text-lg font-bold text-on-surface">{selectedGuest.name}</h2>
                <p className="text-sm text-on-surface-variant">{selectedGuest.event_title}</p>
                {selectedGuest.phone && (
                  <p className="text-sm text-outline mt-1" dir="ltr">{selectedGuest.phone}</p>
                )}
              </div>
              <div className="flex-1 overflow-y-auto sidebar-scroll p-5 space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-8">
                    لا توجد رسائل سابقة
                  </p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border border-outline-variant/10 ${
                        m.direction === "incoming"
                          ? "bg-primary/5 border-primary/20"
                          : "bg-surface-container-high"
                      }`}
                    >
                      <div className="flex justify-between gap-2 text-xs text-on-surface-variant mb-1 flex-wrap">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span>{m.direction === "incoming" ? m.guest_name : m.sender_name || "النظام"}</span>
                          {m.kind && m.kind !== "general" && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-container-high">
                              {m.kind_label}
                            </span>
                          )}
                        </span>
                        <span>{formatDateTime(m.created_at)}</span>
                      </div>
                      <p className="text-on-surface text-sm whitespace-pre-wrap">{m.content}</p>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-outline-variant/10 shrink-0 bg-surface-container/30 space-y-3">
                <textarea
                  className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-sm text-on-surface min-h-[100px] resize-y outline-none focus:ring-2 focus:ring-primary-container/40"
                  placeholder="اكتب رسالتك للضيف..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                {actionMsg && (
                  <p className="text-xs text-primary-container">{actionMsg}</p>
                )}
                <div className="flex flex-wrap gap-2 justify-end">
                  <button
                    type="button"
                    disabled={sending || !body.trim()}
                    onClick={() => handleSend(false)}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-surface-container-high text-on-surface border border-outline-variant/20 hover:bg-surface-container disabled:opacity-50"
                  >
                    تسجيل رسالة
                  </button>
                  <button
                    type="button"
                    disabled={sending || !body.trim() || !selectedGuest.phone}
                    onClick={() => handleSend(true)}
                    className="px-4 py-2 rounded-xl text-sm font-bold bg-[#25D366] text-white hover:bg-[#1da851] disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">chat</span>
                    إرسال واتساب
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm p-8">
              اختر ضيفاً لبدء المراسلة
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
