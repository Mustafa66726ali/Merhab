"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  commsAPI,
  eventsAPI,
  extractApiList,
  type EventListItem,
  type GuestMessageItem,
} from "@/lib/api";
import {
  buildStandaloneGreetingsDocument,
  formatGreetingDateTime,
} from "@/lib/greetingsReportHtml";

function dateOnly(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export default function GuestInboundView() {
  const [tabHint, setTabHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<GuestMessageItem[]>([]);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [eventId, setEventId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [msgRes, eventsRes] = await Promise.all([
        commsAPI.guestMessagesInbound(),
        eventsAPI.list({ page_size: 200 }),
      ]);
      setMessages(msgRes.data.messages || []);
      setEvents(extractApiList<EventListItem>(eventsRes.data));
    } catch {
      setMessages([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTabHint(params.get("tab"));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (eventId !== "all" && String(m.event) !== eventId) return false;
      const d = dateOnly(m.created_at);
      if (dateFrom && d && d < dateFrom) return false;
      if (dateTo && d && d > dateTo) return false;
      if (!q) return true;
      return (
        (m.guest_name || "").toLowerCase().includes(q) ||
        (m.content || "").toLowerCase().includes(q) ||
        (m.recipient_name || "").toLowerCase().includes(q)
      );
    });
  }, [messages, eventId, dateFrom, dateTo, search]);

  const greetings = useMemo(
    () => filtered.filter((m) => m.kind === "greeting"),
    [filtered]
  );
  const inquiries = useMemo(
    () => filtered.filter((m) => m.kind === "inquiry"),
    [filtered]
  );

  const printReport = () => {
    const selectedEvent =
      eventId === "all"
        ? "كل الفعاليات"
        : events.find((e) => String(e.id) === eventId)?.title || "—";

    const html = buildStandaloneGreetingsDocument(
      greetings.map((m) => ({
        guest_name: m.guest_name || "—",
        content: m.content || "",
        created_at: m.created_at,
      })),
      { eventTitle: selectedEvent, title: "تقرير تهنئات الضيوف" }
    );

    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
  };

  const showInquiriesFirst = tabHint === "inquiries";

  return (
    <div className="space-y-5 py-4">
      <div className="rounded-3xl p-5 border border-primary/20 bg-gradient-to-l from-fuchsia-500/10 via-violet-500/10 to-transparent">
        <h1 className="text-2xl sm:text-3xl font-black text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-fuchsia-300">celebration</span>
          تهنئات واستفسارات الضيوف
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">
          رسائل التهنئة والتبريكات واستفسارات الضيوف من صفحة الدعوة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-surface-container-low border border-outline-variant/15 rounded-2xl p-4">
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          className="md:col-span-2 rounded-xl bg-surface-container-high border border-outline-variant/20 px-3 py-2 text-sm outline-none"
        >
          <option value="all">كل الفعاليات</option>
          {events.map((e) => (
            <option key={e.id} value={String(e.id)}>
              {e.title}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-xl bg-surface-container-high border border-outline-variant/20 px-3 py-2 text-sm outline-none"
          aria-label="من تاريخ"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-xl bg-surface-container-high border border-outline-variant/20 px-3 py-2 text-sm outline-none"
          aria-label="إلى تاريخ"
        />
        <input
          type="search"
          placeholder="بحث في الاسم أو نص الرسالة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl bg-surface-container-high border border-outline-variant/20 px-3 py-2 text-sm outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="text-sm text-on-surface-variant">
          تهنئات: <b className="text-on-surface">{greetings.length}</b>
          {" · "}
          استفسارات: <b className="text-on-surface">{inquiries.length}</b>
        </div>
        <button
          type="button"
          onClick={printReport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-primary text-on-primary hover:opacity-90"
        >
          <span className="material-symbols-outlined text-base">print</span>
          طباعة تقرير التهنئات PDF
        </button>
      </div>

      {showInquiriesFirst ? (
        <>
          <InquiriesSection loading={loading} inquiries={inquiries} />
          <GreetingsSection loading={loading} greetings={greetings} />
        </>
      ) : (
        <>
          <GreetingsSection loading={loading} greetings={greetings} />
          <InquiriesSection loading={loading} inquiries={inquiries} />
        </>
      )}
    </div>
  );
}

function GreetingsSection({
  loading,
  greetings,
}: {
  loading: boolean;
  greetings: GuestMessageItem[];
}) {
  return (
    <section
      id="gratitudes"
      className="bg-surface-container-low rounded-2xl border border-emerald-500/20 p-4 sm:p-5"
    >
      <h2 className="text-lg font-bold text-emerald-300 mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined">celebration</span>
        التهنئات
      </h2>
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : greetings.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          لا توجد تهنئات ضمن الفلاتر المحددة
        </p>
      ) : (
        <div className="space-y-3">
          {greetings.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <b className="text-on-surface">{m.guest_name}</b>
                <span className="text-xs text-on-surface-variant">
                  {formatGreetingDateTime(m.created_at)}
                </span>
              </div>
              <p className="text-sm text-on-surface whitespace-pre-wrap">{m.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function InquiriesSection({
  loading,
  inquiries,
}: {
  loading: boolean;
  inquiries: GuestMessageItem[];
}) {
  return (
    <section
      id="inquiries"
      className="bg-surface-container-low rounded-2xl border border-amber-500/20 p-4 sm:p-5"
    >
      <h2 className="text-lg font-bold text-amber-300 mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined">help</span>
        الاستفسارات
      </h2>
      {loading ? (
        <div className="flex justify-center py-12">
          <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : inquiries.length === 0 ? (
        <p className="text-sm text-on-surface-variant text-center py-8">
          لا توجد استفسارات ضمن الفلاتر المحددة
        </p>
      ) : (
        <div className="space-y-3">
          {inquiries.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div>
                  <b className="text-on-surface">{m.guest_name}</b>
                  {m.recipient_name && (
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      للمنسّق: {m.recipient_name}
                    </p>
                  )}
                </div>
                <span className="text-xs text-on-surface-variant">
                  {formatGreetingDateTime(m.created_at)}
                </span>
              </div>
              <p className="text-sm text-on-surface whitespace-pre-wrap">{m.content}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
