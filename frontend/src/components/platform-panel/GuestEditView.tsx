"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PhoneNumberField from "@/components/common/PhoneNumberField";
import { GUEST_STATUS_OPTIONS } from "@/components/events/guestStatus";
import { useEvent } from "@/hooks/useEvent";
import { guestsAPI, type EventGuestDetail } from "@/lib/api";

interface GuestEditViewProps {
  guestId: number;
  guestsBasePath: string;
  eventsBasePath: string;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 tracking-wide">
      {children}
    </label>
  );
}

const inputClass =
  "w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-container/40 transition-all";

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const data = (e as { response?: { data?: Record<string, unknown> } }).response?.data;
    if (data) {
      const detail = data.detail;
      if (typeof detail === "string" && detail.trim()) return detail;
      if (Array.isArray(detail) && typeof detail[0] === "string") return detail[0];
      for (const value of Object.values(data)) {
        if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      }
    }
  }
  return fallback;
}

export default function GuestEditView({
  guestId,
  guestsBasePath,
  eventsBasePath,
}: GuestEditViewProps) {
  const router = useRouter();
  const [guest, setGuest] = useState<EventGuestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("pending");
  const [sectionId, setSectionId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [dietary, setDietary] = useState("");

  const eventQuery = useEvent(guest?.event ?? 0);
  const event = eventQuery.data;
  const sectionsLoading = Boolean(guest?.event) && eventQuery.isLoading;

  useEffect(() => {
    setLoading(true);
    guestsAPI
      .get(guestId)
      .then((res) => {
        const g = res.data;
        setGuest(g);
        setFullName(g.full_name);
        setEmail(g.email || "");
        setPhone(g.phone || "");
        setStatus(g.status);
        setSectionId(g.section ? String(g.section) : "");
        setGroupId(g.group ? String(g.group) : "");
        setNotes(g.notes || "");
        setDietary(g.dietary_requirements || "");
      })
      .catch(() => setError("تعذّر تحميل بيانات الضيف."))
      .finally(() => setLoading(false));
  }, [guestId]);

  const sectionOptions = useMemo(() => {
    return (event?.sections ?? []).map((s) => ({ value: String(s.id), label: s.name }));
  }, [event]);

  const groupOptions = useMemo(() => {
    if (!sectionId) return [];
    const section = event?.sections?.find((s) => String(s.id) === sectionId);
    return (section?.groups ?? []).map((g) => ({ value: String(g.id), label: g.name }));
  }, [event, sectionId]);

  const guestHasAssignment = Boolean(guest?.section_name || guest?.group_name);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError("اسم الضيف مطلوب.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await guestsAPI.patch(guestId, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        status,
        section: sectionId ? Number(sectionId) : null,
        group: groupId ? Number(groupId) : null,
        notes: notes.trim(),
        dietary_requirements: dietary.trim(),
      });
      router.push(`${guestsBasePath}/${guestId}`);
    } catch (e) {
      setError(errMessage(e, "تعذّر حفظ التعديلات."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="px-4 py-16 text-center text-on-surface-variant">
        {error || "الضيف غير موجود."}
        <div className="mt-4">
          <Link href={guestsBasePath} className="text-primary font-bold hover:underline">
            العودة إلى قائمة الضيوف
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 max-w-3xl">
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
        <Link href={guestsBasePath} className="hover:text-primary transition-colors">
          الضيوف
        </Link>
        <span className="material-symbols-outlined text-base">chevron_left</span>
        <Link href={`${guestsBasePath}/${guestId}`} className="hover:text-primary transition-colors">
          {guest.full_name}
        </Link>
        <span className="material-symbols-outlined text-base">chevron_left</span>
        <span className="text-on-surface font-medium">تعديل</span>
      </nav>

      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
          تعديل بيانات الضيف
        </h1>
        <p className="text-on-surface-variant text-sm mt-2">
          المناسبة:{" "}
          <Link
            href={`${eventsBasePath}/${guest.event}`}
            className="text-primary font-bold hover:underline"
          >
            {guest.event_title}
          </Link>
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-5">
        <div>
          <FieldLabel>الاسم الكامل</FieldLabel>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <FieldLabel>البريد الإلكتروني</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            dir="ltr"
          />
        </div>

        <div>
          <FieldLabel>رقم الجوال</FieldLabel>
          <PhoneNumberField value={phone} onChange={setPhone} />
        </div>

        <div>
          <FieldLabel>الحالة</FieldLabel>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputClass}
          >
            {GUEST_STATUS_OPTIONS.filter((o) => o.value).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-high/30 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">grid_view</span>
                التوزيع على الأقسام والمجموعات
              </h2>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                يمكنك إسناد الضيف لقسم أو مجموعة لاحقاً حتى لو أُضيف بدون تصنيف.
              </p>
            </div>
            {!guestHasAssignment && !sectionId && (
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-300">
                غير مُسنَد
              </span>
            )}
          </div>

          {sectionsLoading ? (
            <p className="text-sm text-on-surface-variant py-2">جاري تحميل أقسام المناسبة...</p>
          ) : sectionOptions.length === 0 ? (
            <div className="rounded-xl border border-outline-variant/15 bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant space-y-2">
              <p>لا توجد أقسام في هذه المناسبة بعد.</p>
              <Link
                href={`${eventsBasePath}/${guest.event}`}
                className="inline-flex items-center gap-1 text-primary font-bold text-xs hover:underline"
              >
                إدارة المناسبة وإضافة أقسام
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>القسم</FieldLabel>
                <select
                  value={sectionId}
                  onChange={(e) => {
                    setSectionId(e.target.value);
                    setGroupId("");
                  }}
                  className={inputClass}
                >
                  <option value="">بدون قسم</option>
                  {sectionOptions.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>المجموعة</FieldLabel>
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  disabled={!sectionId}
                  className={inputClass}
                >
                  <option value="">
                    {sectionId ? "بدون مجموعة" : "اختر قسماً أولاً"}
                  </option>
                  {groupOptions.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                {sectionId && groupOptions.length === 0 && (
                  <p className="text-[11px] text-on-surface-variant mt-1.5">
                    هذا القسم لا يحتوي مجموعات — يمكن حفظ الإسناد للقسم فقط.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <FieldLabel>ملاحظات</FieldLabel>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass + " resize-y min-h-[80px]"}
          />
        </div>

        <div>
          <FieldLabel>متطلبات غذائية</FieldLabel>
          <textarea
            value={dietary}
            onChange={(e) => setDietary(e.target.value)}
            rows={2}
            className={inputClass + " resize-y min-h-[72px]"}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 justify-end">
        <Link
          href={`${guestsBasePath}/${guestId}`}
          className="px-5 py-2.5 rounded-xl border border-outline-variant/25 text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors"
        >
          إلغاء
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
        </button>
      </div>
    </div>
  );
}
