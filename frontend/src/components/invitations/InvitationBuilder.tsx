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

const REMIND_UNCONFIRMED_DEFAULT: TemplateFields = {
  greeting: "تذكير ودّي",
  intro: "لم نستلم تأكيد حضورك بعد لمناسبة",
  showDateTime: true,
  showVenue: true,
  cta: "نرجو تأكيد حضورك أو الاعتذار عبر الرابط:",
};

const REMIND_CONFIRMED_DEFAULT: TemplateFields = {
  greeting: "تذكير بموعد المناسبة",
  intro: "يسعدنا لقاؤك في",
  showDateTime: true,
  showVenue: true,
  cta: "احتفظ ببطاقة دخولك (QR) عبر الرابط:",
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
    ready: boolean;
    state?: string;
    queue?: number;
    error?: string;
  } | null>(null);

  // وضع العمل: دعوة جديدة أو تذكير
  const [mode, setMode] = useState<"invite" | "remind">("invite");
  const [remindUnconf, setRemindUnconf] = useState<TemplateFields>(
    REMIND_UNCONFIRMED_DEFAULT
  );
  const [remindConf, setRemindConf] = useState<TemplateFields>(
    REMIND_CONFIRMED_DEFAULT
  );
  const [reminderResults, setReminderResults] = useState<
    InvitationReminderResult[] | null
  >(null);

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
      setNotice(
        autoSend
          ? `تم إرسال ${res.data.count} دعوة تلقائياً عبر المزوّد.`
          : `تم تجهيز ${res.data.count} دعوة — افتح واتساب لكل ضيف لإتمام الإرسال.`
      );
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
        message_unconfirmed: assembleTemplate(remindUnconf),
        message_confirmed: assembleTemplate(remindConf),
        auto: autoSend,
      };
      if (audienceType === "section") payload.section = sectionId;
      else if (audienceType === "group") payload.group = groupId;
      else if (audienceType === "custom") payload.guest_ids = Array.from(customIds);
      const res = await invitationsAPI.remindBatch(payload);
      setReminderResults(res.data.reminders);
      const skippedNote = res.data.skipped
        ? ` (تم تجاوز ${res.data.skipped} معتذر)`
        : "";
      setNotice(
        autoSend
          ? `تم إرسال ${res.data.count} تذكير${skippedNote} تلقائياً عبر المزوّد.`
          : `تم تجهيز ${res.data.count} تذكير${skippedNote} — افتح واتساب لكل ضيف لإتمام الإرسال.`
      );
    } catch (e) {
      setError(errMessage(e, "تعذّر إرسال التذكيرات."));
    } finally {
      setSending(false);
    }
  };

  const canAuto = !!bot && bot.provider !== "manual";
  const [sendingOne, setSendingOne] = useState<Set<number>>(new Set());

  const sendOne = async (guestId: number, msg: string) => {
    setSendingOne((p) => new Set(p).add(guestId));
    setError("");
    try {
      const res = await invitationsAPI.sendOne({ guest_id: guestId, message: msg });
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
              {bot.provider === "manual"
                ? "وضع يدوي"
                : bot.provider === "bot"
                  ? bot.ready
                    ? "البوت متصل"
                    : "البوت غير جاهز"
                  : "مزوّد API"}
            </span>
          )}
          <button
            type="button"
            onClick={() => setAutoSend((v) => !v)}
            disabled={!!bot && bot.provider === "manual"}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${
              autoSend
                ? "bg-emerald-500/90 text-white"
                : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
            }`}
            title={
              bot && bot.provider === "manual"
                ? "فعّل WHATSAPP_PROVIDER=bot أو api لتمكين الإرسال التلقائي"
                : "إرسال تلقائي دون فتح واتساب يدوياً"
            }
          >
            <span className="material-symbols-outlined text-base">
              {autoSend ? "bolt" : "bolt"}
            </span>
            إرسال تلقائي {autoSend ? "(مفعّل)" : ""}
          </button>
        </div>
      </div>

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
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  يُرسَل التذكير تلقائياً حسب حالة الضيف: من لم يؤكّد يصله تذكير
                  بالتأكيد، ومن أكّد يصله تذكير بموعد المناسبة. المعتذرون يُتجاوزون.
                </p>
              </div>

              <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                <p className="text-sm font-bold text-on-surface flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-400 text-lg">
                    schedule_send
                  </span>
                  تذكير لمن لم يؤكّد الحضور
                </p>
                <TemplateFieldsEditor
                  value={remindUnconf}
                  onChange={setRemindUnconf}
                  eventMeta={eventMeta}
                />
              </div>

              <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
                <p className="text-sm font-bold text-on-surface flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-emerald-400 text-lg">
                    event_available
                  </span>
                  تذكير لمن أكّد الحضور
                </p>
                <TemplateFieldsEditor
                  value={remindConf}
                  onChange={setRemindConf}
                  eventMeta={eventMeta}
                />
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
                  معاينة التذكير
                </p>
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                  <p className="text-[11px] font-bold text-amber-300 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">schedule_send</span>
                    لمن لم يؤكّد
                  </p>
                  <p className="text-sm text-on-surface-variant whitespace-pre-line leading-relaxed text-right">
                    {renderPreview(assembleTemplate(remindUnconf))}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3">
                  <p className="text-[11px] font-bold text-emerald-300 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">event_available</span>
                    لمن أكّد
                  </p>
                  <p className="text-sm text-on-surface-variant whitespace-pre-line leading-relaxed text-right">
                    {renderPreview(assembleTemplate(remindConf))}
                  </p>
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
                      className="flex items-center gap-2 bg-surface-container-high rounded-xl px-3 py-2"
                    >
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
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
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
                      className="flex items-center gap-2 bg-surface-container-high rounded-xl px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-on-surface truncate">
                          {r.full_name}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.kind === "confirmed"
                              ? "text-emerald-300 bg-emerald-400/10"
                              : "text-amber-300 bg-amber-400/10"
                          }`}
                        >
                          {r.kind === "confirmed" ? "تذكير بالموعد" : "تذكير بالتأكيد"}
                        </span>
                      </div>
                      {r.auto ? (
                        <span
                          title={r.detail}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold ${
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
