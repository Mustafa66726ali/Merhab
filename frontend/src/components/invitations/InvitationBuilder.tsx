"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  eventsAPI,
  guestsAPI,
  invitationsAPI,
  type EventGuestRow,
  type InvitationReminderResult,
  type InvitationSendResult,
} from "@/lib/api";

interface Props {
  eventId: number;
}

interface SimpleOption {
  id: number;
  name: string;
}

type ListResponse = EventGuestRow[] | { results?: EventGuestRow[] };
function normalizeGuests(data: ListResponse): EventGuestRow[] {
  return Array.isArray(data) ? data : data.results ?? [];
}

/**
 * حقول القالب المرتّبة — يحرّرها المنظّم كبطاقة بدل كتابة رموز {name}/{link}.
 * البيانات الديناميكية (الاسم، الفعالية، التاريخ، المكان، الرابط) تُدرَج تلقائياً.
 */
interface TemplateFields {
  greeting: string; // التحية — يتبعها اسم الضيف تلقائياً
  intro: string; // سطر المناسبة — يتبعه اسم الفعالية تلقائياً
  showDateTime: boolean; // إظهار سطر التاريخ والوقت
  showVenue: boolean; // إظهار سطر المكان
  cta: string; // سطر الدعوة الذي يسبق الرابط
}

const INVITE_DEFAULT: TemplateFields = {
  greeting: "مرحباً",
  intro: "يسعدنا دعوتك لحضور",
  showDateTime: true,
  showVenue: true,
  cta: "يرجى تأكيد حضورك عبر الرابط التالي:",
};

/** يبني نص القالب (مع عناصر نائبة) من الحقول المرتّبة. */
function assembleTemplate(f: TemplateFields): string {
  const lines = [`${f.greeting} {name}،`, `${f.intro}: {event}`];
  if (f.showDateTime) lines.push("📅 التاريخ: {date} - {time}");
  if (f.showVenue) lines.push("📍 المكان: {venue}");
  lines.push("");
  lines.push(f.cta);
  lines.push("{link}");
  return lines.join("\n");
}

/** يحاول استخراج الحقول من قالب محفوظ (أفضل جهد) مع رجوع للقيم الافتراضية. */
function parseTemplate(tpl: string, fallback: TemplateFields): TemplateFields {
  if (!tpl || !tpl.trim()) return { ...fallback };
  const lines = tpl.split("\n");
  const f: TemplateFields = { ...fallback };
  const gLine = lines.find((l) => l.includes("{name}"));
  if (gLine) f.greeting = gLine.replace("{name}", "").replace(/[،,]/g, "").trim();
  const iLine = lines.find((l) => l.includes("{event}"));
  if (iLine) f.intro = iLine.replace("{event}", "").replace(/[:：]/, "").trim();
  f.showDateTime = tpl.includes("{date}") || tpl.includes("{time}");
  f.showVenue = tpl.includes("{venue}");
  const linkIdx = lines.findIndex((l) => l.includes("{link}"));
  if (linkIdx > 0) {
    for (let k = linkIdx - 1; k >= 0; k--) {
      const l = lines[k].trim();
      if (!l) continue;
      if (/\{(name|event|date|time|venue|section|group)\}/.test(l)) break;
      f.cta = l;
      break;
    }
  }
  return f;
}

/** مفتاح تبديل صغير. */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-primary" : "bg-surface-container-highest"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-0.5" : "right-0.5"
        }`}
      />
    </button>
  );
}

/** بطاقة تحرير القالب بحقول مرتّبة بدل كتابة الرموز. */
function TemplateFieldsEditor({
  value,
  onChange,
  eventMeta,
}: {
  value: TemplateFields;
  onChange: (v: TemplateFields) => void;
  eventMeta: { date: string; time: string; venue: string };
}) {
  const set = (patch: Partial<TemplateFields>) => onChange({ ...value, ...patch });
  const inputCls =
    "flex-1 min-w-0 bg-surface-container-high border border-outline-variant/15 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40";
  const autoChip =
    "inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-container/15 text-[11px] font-bold text-primary shrink-0";

  return (
    <div className="space-y-4" dir="rtl">
      {/* التحية */}
      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1.5 block">
          التحية
        </label>
        <div className="flex items-center gap-2">
          <input
            value={value.greeting}
            onChange={(e) => set({ greeting: e.target.value })}
            placeholder="مثال: مرحباً"
            className={inputCls}
          />
          <span className={autoChip}>
            <span className="material-symbols-outlined text-sm">person</span>
            اسم الضيف
          </span>
        </div>
      </div>

      {/* سطر المناسبة */}
      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1.5 block">
          سطر المناسبة
        </label>
        <div className="flex items-center gap-2">
          <input
            value={value.intro}
            onChange={(e) => set({ intro: e.target.value })}
            placeholder="مثال: يسعدنا دعوتك لحضور"
            className={inputCls}
          />
          <span className={autoChip}>
            <span className="material-symbols-outlined text-sm">celebration</span>
            اسم الفعالية
          </span>
        </div>
      </div>

      {/* التاريخ والوقت */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-high px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">
              calendar_month
            </span>
            التاريخ والوقت
          </p>
          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
            {eventMeta.date || "—"}
            {eventMeta.time ? ` - ${eventMeta.time.slice(0, 5)}` : ""}
          </p>
        </div>
        <Toggle
          checked={value.showDateTime}
          onChange={(v) => set({ showDateTime: v })}
        />
      </div>

      {/* المكان */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container-high px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base text-primary">
              location_on
            </span>
            المكان
          </p>
          <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
            {eventMeta.venue || "غير محدد"}
          </p>
        </div>
        <Toggle checked={value.showVenue} onChange={(v) => set({ showVenue: v })} />
      </div>

      {/* سطر دعوة الرابط */}
      <div>
        <label className="text-xs font-bold text-on-surface-variant mb-1.5 block">
          سطر دعوة الرابط
        </label>
        <input
          value={value.cta}
          onChange={(e) => set({ cta: e.target.value })}
          placeholder="مثال: يرجى تأكيد حضورك عبر الرابط التالي:"
          className={`${inputCls} w-full`}
        />
        <p className="text-[11px] text-on-surface-variant mt-1.5 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm text-emerald-400">link</span>
          يُرسَل رابط الدعوة القابل للنقر في رسالة منفصلة بعد النص.
        </p>
      </div>
    </div>
  );
}

function errMessage(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (data) {
    const first = Object.values(data)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    if (typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

/** محرّر الدعوات: تحرير القالب، اختيار الجمهور (الكل/قسم/مجموعة/ضيوف)، معاينة، وإرسال عبر واتساب. */
export default function InvitationBuilder({ eventId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [inviteFields, setInviteFields] = useState<TemplateFields>(INVITE_DEFAULT);
  const [guests, setGuests] = useState<EventGuestRow[]>([]);
  const [sections, setSections] = useState<SimpleOption[]>([]);
  const [groups, setGroups] = useState<SimpleOption[]>([]);
  const [eventMeta, setEventMeta] = useState<{
    title: string;
    date: string;
    time: string;
    venue: string;
  }>({ title: "", date: "", time: "", venue: "" });

  const [audienceType, setAudienceType] = useState<"all" | "section" | "group" | "custom">(
    "all"
  );
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [customIds, setCustomIds] = useState<Set<number>>(new Set());

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const [results, setResults] = useState<InvitationSendResult[] | null>(null);

  // الأتمتة: إرسال تلقائي عبر المزوّد (بوت/Twilio) بدل الروابط اليدوية
  const [autoSend, setAutoSend] = useState(false);
  const [bot, setBot] = useState<{
    provider: string;
    configured?: string;
    label?: string;
    automated?: boolean;
    ready: boolean;
    state?: string;
    queue?: number;
    error?: string;
    issues?: string[];
    warnings?: string[];
  } | null>(null);

  // التذكير التلقائي قبل الحفل (يُرسل عبر Twilio دون تدخّل)
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(false);
  const [autoReminderHours, setAutoReminderHours] = useState(3);
  const [savingReminder, setSavingReminder] = useState(false);

  // وضع العمل: دعوة جديدة أو تذكير
  const [mode, setMode] = useState<"invite" | "remind">("invite");
  const [reminderResults, setReminderResults] = useState<
    InvitationReminderResult[] | null
  >(null);

  // إرسال عام لكل الضيوف عبر المزوّد الرسمي (Twilio/Cloud) مع نافذة متابعة منبثقة
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkPhase, setBulkPhase] = useState<"sending" | "done" | "error">(
    "sending"
  );
  const [bulkSummary, setBulkSummary] = useState<{
    kind: "invite" | "remind";
    total: number;
    sent: number;
    failed: number;
    skipped?: number;
    firstError?: string;
  } | null>(null);
  const [bulkError, setBulkError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tplRes, evRes, guestsRes, groupsRes] = await Promise.all([
        invitationsAPI.getTemplate(eventId),
        eventsAPI.get(eventId),
        guestsAPI.list({ event: eventId, page_size: 500 }),
        eventsAPI.groupsOverview(eventId),
      ]);
      setTitle(tplRes.data.invitation_title || evRes.data.title || "");
      setInviteFields(
        parseTemplate(
          tplRes.data.invitation_message || tplRes.data.default_template || "",
          INVITE_DEFAULT
        )
      );
      setEventMeta({
        title: evRes.data.title || "",
        date: evRes.data.date || "",
        time: evRes.data.time || "",
        venue: evRes.data.venue || "",
      });
      setAutoReminderEnabled(!!tplRes.data.auto_reminder_enabled);
      setAutoReminderHours(tplRes.data.auto_reminder_hours_before || 3);
      setGuests(normalizeGuests(guestsRes.data as ListResponse));
      setSections((groupsRes.data.sections ?? []).map((s) => ({ id: s.id, name: s.name })));
      setGroups((groupsRes.data.groups ?? []).map((g) => ({ id: g.id, name: g.name })));
      setError("");
    } catch (e) {
      setError(errMessage(e, "تعذّر تحميل بيانات الدعوة."));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    invitationsAPI
      .botStatus()
      .then((r) => {
        setBot(r.data);
        if (r.data.provider !== "manual" && r.data.ready) setAutoSend(true);
      })
      .catch(() => setBot(null));
  }, []);

  const targetGuests = useMemo(() => {
    if (audienceType === "all") return guests;
    if (audienceType === "section")
      return guests.filter((g) => g.section === sectionId);
    if (audienceType === "group") return guests.filter((g) => g.group === groupId);
    return guests.filter((g) => customIds.has(g.id));
  }, [audienceType, guests, sectionId, groupId, customIds]);

  const renderPreview = (raw: string): string => {
    const sample = targetGuests[0];
    const map: Record<string, string> = {
      name: sample?.full_name || "اسم الضيف",
      event: eventMeta.title,
      date: eventMeta.date,
      time: eventMeta.time ? eventMeta.time.slice(0, 5) : "",
      venue: eventMeta.venue || "—",
      section: sample?.section_name || "—",
      group: sample?.group_name || "—",
      link: "(رابط الدعوة الفريد)",
    };
    const hasLink = raw.includes("{link}");
    let out = raw;
    for (const [k, v] of Object.entries(map)) out = out.replaceAll(`{${k}}`, v);
    // يُضاف الرابط تلقائياً في نهاية الرسالة إن لم يُدرج ضمن النص
    if (!hasLink) out = `${out.trimEnd()}\n\n${map.link}`;
    return out;
  };

  const saveTemplate = async () => {
    setSaving(true);
    setNotice("");
    try {
      await invitationsAPI.saveTemplate({
        event: eventId,
        invitation_title: title,
        invitation_message: assembleTemplate(inviteFields),
      });
      setNotice("تم حفظ القالب الافتراضي للفعالية.");
    } catch (e) {
      setError(errMessage(e, "تعذّر حفظ القالب."));
    } finally {
      setSaving(false);
    }
  };

  const saveReminderSettings = async (
    enabled: boolean,
    hours: number
  ) => {
    setSavingReminder(true);
    setError("");
    setNotice("");
    try {
      await invitationsAPI.saveTemplate({
        event: eventId,
        invitation_title: title,
        invitation_message: assembleTemplate(inviteFields),
        auto_reminder_enabled: enabled,
        auto_reminder_hours_before: hours,
      });
      setAutoReminderEnabled(enabled);
      setAutoReminderHours(hours);
      setNotice(
        enabled
          ? `تم تفعيل التذكير التلقائي قبل الحفل بـ ${hours} ساعة.`
          : "تم إيقاف التذكير التلقائي."
      );
    } catch (e) {
      setError(errMessage(e, "تعذّر حفظ إعدادات التذكير التلقائي."));
    } finally {
      setSavingReminder(false);
    }
  };

  const canAuto = !!bot && bot.provider !== "manual";

  // الإرسال العام لكل الضيوف متاح فقط مع مزوّد رسمي (Twilio/Cloud) — لا البوت
  const isOfficialApi =
    !!bot &&
    (bot.provider === "twilio" || bot.provider === "cloud") &&
    bot.ready;

  const send = async () => {
    if (targetGuests.length === 0) {
      setError("لا يوجد ضيوف ضمن الجمهور المحدد.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    setResults(null);
    try {
      const payload: Parameters<typeof invitationsAPI.sendBatch>[0] = {
        event: eventId,
        title,
        message: assembleTemplate(inviteFields),
        auto: autoSend,
      };
      if (audienceType === "section") payload.section = sectionId;
      else if (audienceType === "group") payload.group = groupId;
      else if (audienceType === "custom") payload.guest_ids = Array.from(customIds);
      const res = await invitationsAPI.sendBatch(payload);
      setResults(res.data.invitations);
      const sentOk = res.data.invitations.filter((r) => r.sent).length;
      const failed = res.data.count - sentOk;
      if (autoSend) {
        if (failed > 0) {
          const firstErr =
            res.data.invitations.find((r) => !r.sent)?.detail || "خطأ غير معروف";
          setError(`فشل إرسال ${failed} من ${res.data.count}. السبب: ${firstErr}`);
          setNotice(`نجح ${sentOk} — فشل ${failed}`);
        } else {
          setNotice(`تم إرسال ${sentOk} دعوة تلقائياً عبر ${bot?.label || "المزوّد"}.`);
        }
      } else {
        setNotice(
          `تم تجهيز ${res.data.count} دعوة — فعّل «إرسال تلقائي» لإرسالها عبر Twilio.`
        );
      }
    } catch (e) {
      setError(errMessage(e, "تعذّر إرسال الدعوات."));
    } finally {
      setSending(false);
    }
  };

  const sendReminders = async () => {
    if (targetGuests.length === 0) {
      setError("لا يوجد ضيوف ضمن الجمهور المحدد.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    setReminderResults(null);
    try {
      const payload: Parameters<typeof invitationsAPI.remindBatch>[0] = {
        event: eventId,
        auto: isOfficialApi || autoSend,
      };
      if (audienceType === "section") payload.section = sectionId;
      else if (audienceType === "group") payload.group = groupId;
      else if (audienceType === "custom") payload.guest_ids = Array.from(customIds);
      const res = await invitationsAPI.remindBatch(payload);
      setReminderResults(res.data.reminders);
      const skippedNote = res.data.skipped
        ? ` (تم تجاوز ${res.data.skipped} معتذر)`
        : "";
      if (isOfficialApi || autoSend) {
        const sentOk = res.data.sent ?? res.data.reminders.filter((r) => r.sent).length;
        const failed = res.data.count - sentOk;
        if (failed > 0) {
          const firstErr =
            res.data.reminders.find((r) => !r.sent)?.detail || "خطأ غير معروف";
          setError(`فشل إرسال ${failed} من ${res.data.count}. السبب: ${firstErr}`);
          setNotice(`نجح ${sentOk} — فشل ${failed}${skippedNote}`);
        } else {
          setNotice(`تم إرسال ${res.data.count} تذكير${skippedNote} تلقائياً عبر المزوّد.`);
        }
      } else {
        setNotice(
          `تم تجهيز ${res.data.count} تذكير${skippedNote} — افتح واتساب لكل ضيف لإتمام الإرسال.`
        );
      }
    } catch (e) {
      setError(errMessage(e, "تعذّر إرسال التذكيرات."));
    } finally {
      setSending(false);
    }
  };

  const sendToAll = async () => {
    if (!isOfficialApi) return;
    if (guests.length === 0) {
      setError("لا يوجد ضيوف لإرسال الرسائل إليهم.");
      return;
    }
    setBulkSummary(null);
    setBulkError("");
    setBulkPhase("sending");
    setBulkOpen(true);
    setSending(true);
    try {
      if (mode === "invite") {
        const res = await invitationsAPI.sendBatch({
          event: eventId,
          title,
          message: assembleTemplate(inviteFields),
          auto: true,
        });
        const list = res.data.invitations || [];
        setResults(list);
        const total = res.data.count ?? list.length;
        const sent = list.filter((r) => r.sent).length;
        const firstError = list.find((r) => !r.sent)?.detail;
        setBulkSummary({
          kind: "invite",
          total,
          sent,
          failed: total - sent,
          firstError: firstError || undefined,
        });
        if (total - sent > 0 && firstError) {
          setError(`فشل إرسال ${total - sent} من ${total}. السبب: ${firstError}`);
        }
      } else {
        const res = await invitationsAPI.remindBatch({
          event: eventId,
          auto: true,
        });
        const list = res.data.reminders || [];
        setReminderResults(list);
        const total = res.data.count ?? list.length;
        const sent = list.filter((r) => r.sent).length;
        const firstError = list.find((r) => !r.sent)?.detail;
        setBulkSummary({
          kind: "remind",
          total,
          sent,
          failed: total - sent,
          skipped: res.data.skipped,
          firstError: firstError || undefined,
        });
        if (total - sent > 0 && firstError) {
          setError(`فشل إرسال ${total - sent} من ${total}. السبب: ${firstError}`);
        }
      }
      setBulkPhase("done");
    } catch (e) {
      setBulkError(errMessage(e, "تعذّر إتمام الإرسال العام."));
      setBulkPhase("error");
    } finally {
      setSending(false);
    }
  };

  const [sendingOne, setSendingOne] = useState<Set<number>>(new Set());

  const sendOne = async (guestId: number, msg: string) => {
    setSendingOne((p) => new Set(p).add(guestId));
    setError("");
    try {
      const res = await invitationsAPI.sendOne({
        guest_id: guestId,
        message: msg,
        kind: mode === "remind" ? "remind" : "invite",
      });
      const { sent, detail } = res.data;
      setResults((prev) =>
        prev
          ? prev.map((r) =>
              r.guest_id === guestId ? { ...r, auto: true, sent, detail } : r
            )
          : prev
      );
      setReminderResults((prev) =>
        prev
          ? prev.map((r) =>
              r.guest_id === guestId ? { ...r, auto: true, sent, detail } : r
            )
          : prev
      );
      if (!sent && detail) {
        setError(detail);
      }
    } catch (e) {
      setError(errMessage(e, "تعذّر الإرسال عبر البوت."));
    } finally {
      setSendingOne((p) => {
        const n = new Set(p);
        n.delete(guestId);
        return n;
      });
    }
  };

  const toggleCustom = (id: number) => {
    setCustomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* تبديل الوضع + الأتمتة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-2xl bg-surface-container-low border border-outline-variant/10 p-1">
          {[
            { v: "invite", label: "دعوة جديدة", icon: "mail" },
            { v: "remind", label: "تذكير الضيوف", icon: "notifications_active" },
          ].map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => setMode(m.v as typeof mode)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                mode === m.v
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-base">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* مفتاح الإرسال التلقائي + حالة المزوّد */}
        <div className="flex items-center gap-3">
          {bot && (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                bot.provider === "manual"
                  ? "bg-surface-container-high text-on-surface-variant"
                  : bot.ready
                    ? "bg-emerald-400/10 text-emerald-300"
                    : "bg-amber-400/10 text-amber-300"
              }`}
              title={bot.error || bot.state || ""}
            >
              <span className="material-symbols-outlined text-sm">
                {bot.provider === "manual"
                  ? "link"
                  : bot.provider === "bot"
                    ? "smart_toy"
                    : "cloud_done"}
              </span>
              {bot.provider === "bot" && !bot.ready
                ? "البوت غير جاهز"
                : bot.label ||
                  (bot.provider === "manual" ? "وضع يدوي" : "مزوّد API")}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAutoSend((v) => !v)}
            disabled={!!bot && (bot.provider === "manual" || !bot.ready)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
              autoSend
                ? "bg-emerald-500/90 text-white"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
            title={
              bot && bot.provider === "manual"
                ? "أضِف اعتماد تكامل نشط (Twilio/Cloud) أو فعّل البوت لتمكين الإرسال التلقائي"
                : "إرسال تلقائي دون فتح واتساب يدوياً"
            }
          >
            <span className="material-symbols-outlined text-base">
              {autoSend ? "bolt" : "bolt"}
            </span>
            إرسال تلقائي {autoSend ? "(مفعّل)" : ""}
          </button>

          {/* إرسال عام لكل الضيوف — متاح فقط مع مزوّد رسمي (Twilio/Cloud) */}
          <button
            type="button"
            onClick={sendToAll}
            disabled={!isOfficialApi || sending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-on-primary hover:opacity-90"
            title={
              isOfficialApi
                ? "إرسال مباشر لكل الضيوف عبر Twilio"
                : "متاح فقط عند تفعيل مزوّد رسمي (Twilio/Cloud) — غير متاح مع البوت"
            }
          >
            <span className="material-symbols-outlined text-base">campaign</span>
            {mode === "invite"
              ? "إرسال الدعوات للجميع"
              : "إرسال التذكيرات للجميع"}
          </button>
        </div>
      </div>

      {bot?.issues && bot.issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-bold mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            إعداد Twilio غير مكتمل — لن تُرسل الدعوات حتى تُصلَح:
          </p>
          <ul className="list-disc list-inside space-y-1 text-amber-200/90 text-xs">
            {bot.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {bulkOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-surface-container-high border border-outline-variant/15 shadow-2xl p-6 text-center">
            {bulkPhase === "sending" && (
              <>
                <div className="mx-auto mb-4 h-14 w-14 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
                <h3 className="text-lg font-extrabold text-on-surface">
                  {mode === "invite"
                    ? "جارٍ إرسال الدعوات للجميع…"
                    : "جارٍ إرسال التذكيرات للجميع…"}
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  يتم الإرسال عبر {bot?.label || "Twilio"} والتحقق من نتيجة التسليم
                  لكل ضيف ({guests.length}). قد يستغرق ذلك بضع ثوانٍ لكل رسالة…
                </p>
              </>
            )}

            {bulkPhase === "done" && bulkSummary && (
              <>
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-emerald-500/15 text-emerald-400 grid place-items-center">
                  <span className="material-symbols-outlined text-3xl">
                    check_circle
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-on-surface">
                  اكتمل الإرسال
                </h3>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-surface-container p-3">
                    <div className="text-xl font-extrabold text-on-surface">
                      {bulkSummary.total}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      الإجمالي
                    </div>
                  </div>
                  <div className="rounded-xl bg-emerald-500/10 p-3">
                    <div className="text-xl font-extrabold text-emerald-400">
                      {bulkSummary.sent}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      تم الإرسال
                    </div>
                  </div>
                  <div className="rounded-xl bg-rose-500/10 p-3">
                    <div className="text-xl font-extrabold text-rose-400">
                      {bulkSummary.failed}
                    </div>
                    <div className="text-[11px] text-on-surface-variant">
                      فشل
                    </div>
                  </div>
                </div>
                {typeof bulkSummary.skipped === "number" &&
                  bulkSummary.skipped > 0 && (
                    <p className="mt-3 text-xs text-on-surface-variant">
                      تم تجاوز {bulkSummary.skipped} ضيفاً (معتذر).
                    </p>
                  )}
                {bulkSummary.failed > 0 && bulkSummary.firstError && (
                  <p className="mt-3 text-xs text-rose-300 text-start leading-relaxed break-words rounded-xl bg-rose-500/10 px-3 py-2">
                    سبب الفشل: {bulkSummary.firstError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="mt-5 w-full rounded-xl bg-primary text-on-primary py-2.5 font-bold hover:opacity-90"
                >
                  تم
                </button>
              </>
            )}

            {bulkPhase === "error" && (
              <>
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-rose-500/15 text-rose-400 grid place-items-center">
                  <span className="material-symbols-outlined text-3xl">
                    error
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-on-surface">
                  تعذّر الإرسال
                </h3>
                <p className="mt-2 text-sm text-on-surface-variant">
                  {bulkError}
                </p>
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="mt-5 w-full rounded-xl bg-surface-container text-on-surface py-2.5 font-bold hover:opacity-90"
                >
                  إغلاق
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* المحرّر */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* الجمهور */}
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">groups</span>
              الجمهور المستهدف
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { v: "all", label: "كل الضيوف" },
                { v: "section", label: "حسب القسم" },
                { v: "group", label: "حسب المجموعة" },
                { v: "custom", label: "ضيوف محددون" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setAudienceType(opt.v as typeof audienceType)}
                  className={`py-2 rounded-xl text-xs font-bold transition-colors ${
                    audienceType === opt.v
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {audienceType === "section" && (
              <select
                value={sectionId ?? ""}
                onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : null)}
                className="mt-3 w-full bg-surface-container-high border border-outline-variant/15 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">اختر القسم...</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {audienceType === "group" && (
              <select
                value={groupId ?? ""}
                onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}
                className="mt-3 w-full bg-surface-container-high border border-outline-variant/15 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="">اختر المجموعة...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
            {audienceType === "custom" && (
              <div className="mt-3 max-h-52 overflow-y-auto space-y-1 pr-1">
                {guests.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container-high cursor-pointer hover:bg-primary-container/10"
                  >
                    <input
                      type="checkbox"
                      checked={customIds.has(g.id)}
                      onChange={() => toggleCustom(g.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-on-surface flex-1 truncate">{g.full_name}</span>
                    <span className="text-[10px] text-on-surface-variant">{g.group_name}</span>
                  </label>
                ))}
              </div>
            )}

            <p className="text-xs text-on-surface-variant mt-3">
              سيُرسَل إلى{" "}
              <span className="font-bold text-primary tabular-nums">{targetGuests.length}</span>{" "}
              ضيف.
            </p>
          </div>

          {/* التذكير التلقائي قبل الحفل (Twilio) */}
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">
                  schedule_send
                </span>
                التذكير التلقائي قبل الحفل
              </h3>
              <button
                type="button"
                role="switch"
                aria-checked={autoReminderEnabled}
                onClick={() =>
                  saveReminderSettings(!autoReminderEnabled, autoReminderHours)
                }
                disabled={savingReminder}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                  autoReminderEnabled ? "bg-primary" : "bg-surface-container-highest"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    autoReminderEnabled ? "left-0.5" : "right-0.5"
                  }`}
                />
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mb-3">
              يُرسل تويليو التذكيرات تلقائياً لكل الضيوف قبل موعد الحفل دون أي
              تدخّل (تذكير تأكيد لغير المؤكّدين، وتذكير موعد للمؤكّدين).
            </p>

            <label className="text-xs font-bold text-on-surface-variant mb-1.5 block">
              الإرسال قبل الحفل بـ
            </label>
            <div className="flex items-center gap-2">
              <select
                value={autoReminderHours}
                onChange={(e) =>
                  saveReminderSettings(
                    autoReminderEnabled,
                    Number(e.target.value)
                  )
                }
                disabled={savingReminder}
                className="w-full bg-surface-container-high border border-outline-variant/15 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
              >
                {[1, 2, 3, 6, 10, 12, 24, 48].map((h) => (
                  <option key={h} value={h}>
                    {h} ساعة
                  </option>
                ))}
              </select>
            </div>

            {!isOfficialApi && (
              <p className="mt-3 text-xs text-amber-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">info</span>
                لن يعمل التذكير التلقائي إلا بعد تفعيل مزوّد رسمي (Twilio/Cloud)
                — لا يعمل عبر البوت.
              </p>
            )}
            {autoReminderEnabled && isOfficialApi && (
              <p className="mt-3 text-xs text-emerald-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">
                  check_circle
                </span>
                مُفعّل — سيُرسل تلقائياً قبل الحفل بـ {autoReminderHours} ساعة.
              </p>
            )}
          </div>

          {/* القالب — دعوة (بطاقة بحقول) */}
          {mode === "invite" && (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
              <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">edit_note</span>
                نص الدعوة
              </h3>
              <label className="text-xs font-bold text-on-surface-variant mb-1.5 block">
                عنوان الدعوة
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان الدعوة"
                className="w-full bg-surface-container-high border border-outline-variant/15 rounded-xl px-3 py-2.5 text-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40 mb-4"
              />
              <TemplateFieldsEditor
                value={inviteFields}
                onChange={setInviteFields}
                eventMeta={eventMeta}
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-surface-container-highest disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  {saving ? "جارِ الحفظ..." : "حفظ القالب"}
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || targetGuests.length === 0}
                  className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50 flex-1 justify-center"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                  {sending ? "جارِ التجهيز..." : `إرسال (${targetGuests.length})`}
                </button>
              </div>
            </div>
          )}

          {/* القالب — تذكير */}
          {mode === "remind" && (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-4">
              <div className="flex items-start gap-2 rounded-xl bg-primary-container/10 border border-primary/15 px-3 py-2.5">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">
                  info
                </span>
                <div className="text-xs text-on-surface-variant leading-relaxed space-y-2">
                  <p>
                    يُرسل بالترتيب — ضيفاً تلو الآخر بدون تكدس:
                  </p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>
                      من <strong>لم يختر</strong> نعم ذكرني أو لا اعتذر → إعادة{" "}
                      <strong>قالب الدعوة</strong> ثم <strong>قالب التذكير المسبق</strong>.
                    </li>
                    <li>
                      من اختار <strong>نعم ذكرني</strong> → رسالة «مرحبا + الاسم /
                      تبقى لبدء المناسبة + الوقت المتبقي / معه رمز كيو ار كود» ثم{" "}
                      <strong>QR مباشرة</strong>. إذا انتهت المناسبة لا يُرسل شيء.
                    </li>
                    <li>
                      من اختار <strong>لا اعتذر</strong> → لا يُرسل شيء.
                    </li>
                  </ol>
                </div>
              </div>

              <button
                type="button"
                onClick={sendReminders}
                disabled={sending || targetGuests.length === 0}
                className="w-full inline-flex items-center gap-1.5 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50 justify-center"
              >
                <span className="material-symbols-outlined text-base">notifications_active</span>
                {sending ? "جارِ التجهيز..." : `إرسال تذكير (${targetGuests.length})`}
              </button>
            </div>
          )}
        </div>

        {/* المعاينة + النتائج */}
        <div className="col-span-12 lg:col-span-5">
          <div className="lg:sticky lg:top-4 space-y-4">
            {mode === "invite" && (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  معاينة الدعوة
                </p>
                {/* بطاقة دعوة نظيفة — بدون أي عناصر تطبيق */}
                <div className="rounded-2xl overflow-hidden border border-outline-variant/15 bg-surface-container">
                  <div
                    className="h-20"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #c8bfff 100%)",
                    }}
                  />
                  <div className="p-5 text-center">
                    <h4 className="text-lg font-black text-on-surface">
                      {title || eventMeta.title || "عنوان الدعوة"}
                    </h4>
                    <p className="mt-3 text-sm text-on-surface-variant whitespace-pre-line leading-relaxed text-right">
                      {renderPreview(assembleTemplate(inviteFields)) ||
                        "نص الدعوة سيظهر هنا..."}
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <span className="py-2 rounded-xl bg-primary text-on-primary text-xs font-black">
                        تأكيد الحضور
                      </span>
                      <span className="py-2 rounded-xl bg-surface-container-high text-on-surface text-xs font-black">
                        اعتذار
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mode === "remind" && (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 space-y-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
                  ما الذي يُرسل؟
                </p>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-on-surface-variant leading-relaxed">
                  <p className="text-[11px] font-bold text-amber-300 mb-1.5">
                    لم يختر نعم/لا
                  </p>
                  قالب الدعوة التفاعلي ثم قالب «نعم ذكرني / لا اعتذر» من Twilio.
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-sm text-on-surface-variant leading-relaxed">
                  <p className="text-[11px] font-bold text-emerald-300 mb-1.5">
                    اختار نعم ذكرني
                  </p>
                  رسالة: مرحبا + الاسم، تبقى لبدء المناسبة + الوقت المتبقي، معه رمز
                  كيو ار كود — ثم صورة QR. إذا انتهت المناسبة لا يُرسل شيء.
                </div>
              </div>
            )}

            {mode === "invite" && results && (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  روابط الإرسال ({results.length})
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {results.map((r) => (
                    <div
                      key={r.guest_id}
                      className="bg-surface-container-high rounded-xl px-3 py-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {r.full_name}
                        </p>
                        <p className="text-[10px] text-on-surface-variant truncate" dir="ltr">
                          {r.phone || "بدون رقم"}
                        </p>
                      </div>
                      {r.auto ? (
                        <span
                          title={r.detail}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                            r.sent
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-rose-400/10 text-rose-300"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {r.sent ? "task_alt" : "error"}
                          </span>
                          {r.sent ? "تم الإرسال" : "فشل"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(r.invite_url)}
                            title="نسخ رابط الدعوة"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-black/10"
                          >
                            <span className="material-symbols-outlined text-base">
                              content_copy
                            </span>
                          </button>
                          {canAuto ? (
                            <button
                              type="button"
                              onClick={() => sendOne(r.guest_id, r.message)}
                              disabled={sendingOne.has(r.guest_id)}
                              title="إرسال مباشر عبر البوت"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-bold disabled:opacity-60"
                            >
                              {sendingOne.has(r.guest_id) ? (
                                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <span className="material-symbols-outlined text-sm">send</span>
                              )}
                              إرسال
                            </button>
                          ) : (
                            r.whatsapp_url && (
                              <a
                                href={r.whatsapp_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-bold"
                              >
                                <span className="material-symbols-outlined text-sm">chat</span>
                                واتساب
                              </a>
                            )
                          )}
                        </>
                      )}
                      </div>
                      {r.auto && !r.sent && r.detail && (
                        <p className="text-[11px] leading-relaxed text-rose-300/95 break-words">
                          {r.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mode === "remind" && reminderResults && (
              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  روابط التذكير ({reminderResults.length})
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {reminderResults.map((r) => (
                    <div
                      key={r.guest_id}
                      className="bg-surface-container-high rounded-xl px-3 py-2 space-y-1.5"
                    >
                      <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {r.full_name}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.kind === "opted_in" || r.kind === "confirmed"
                              ? "text-emerald-300 bg-emerald-400/10"
                              : "text-amber-300 bg-amber-400/10"
                          }`}
                        >
                          {r.kind === "opted_in" || r.kind === "confirmed"
                            ? "QR + العدّ التنازلي"
                            : "دعوة + تذكير مسبق"}
                        </span>
                      </div>
                      {r.auto ? (
                        <span
                          title={r.detail}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 ${
                            r.sent
                              ? "bg-emerald-400/10 text-emerald-300"
                              : "bg-rose-400/10 text-rose-300"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {r.sent ? "task_alt" : "error"}
                          </span>
                          {r.sent ? "تم الإرسال" : "فشل"}
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(r.invite_url)}
                            title="نسخ رابط الدعوة"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-black/10"
                          >
                            <span className="material-symbols-outlined text-base">
                              content_copy
                            </span>
                          </button>
                          {canAuto ? (
                            <button
                              type="button"
                              onClick={() => sendOne(r.guest_id, r.message)}
                              disabled={sendingOne.has(r.guest_id)}
                              title="إرسال مباشر عبر البوت"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-bold disabled:opacity-60"
                            >
                              {sendingOne.has(r.guest_id) ? (
                                <span className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                              ) : (
                                <span className="material-symbols-outlined text-sm">send</span>
                              )}
                              إرسال
                            </button>
                          ) : (
                            r.whatsapp_url && (
                              <a
                                href={r.whatsapp_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white text-xs font-bold"
                              >
                                <span className="material-symbols-outlined text-sm">chat</span>
                                واتساب
                              </a>
                            )
                          )}
                        </>
                      )}
                      </div>
                      {r.auto && !r.sent && r.detail && (
                        <p className="text-[11px] leading-relaxed text-rose-300/95 break-words">
                          {r.detail}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
