"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";
import { eventsAPI, platformsAPI, type PlatformStaffMember } from "@/lib/api";
import { parseCoordinateString } from "@/lib/geo";
import { EVENT_PHASES, EVENT_PHASE_WEIGHT } from "@/lib/eventPhases";

const GeoLocationMap = dynamic(
  () => import("@/components/platform-panel/GeoLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] rounded-2xl bg-surface-container-high flex items-center justify-center text-on-surface-variant text-sm">
        جاري تحميل الخريطة...
      </div>
    ),
  }
);

function toTimeInput(value: string | null | undefined) {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function fieldInput(className = "") {
  return `w-full bg-surface-container-lowest border-none ring-1 ring-outline-variant/20 focus:ring-2 focus:ring-primary/50 rounded-2xl px-5 py-3.5 text-on-surface text-sm transition-all outline-none placeholder:text-on-surface-variant/40 ${className}`;
}

interface PlatformEventFormProps {
  mode: "add" | "edit";
  eventId?: number;
}

export default function PlatformEventForm({ mode, eventId }: PlatformEventFormProps) {
  const isEdit = mode === "edit" && eventId != null;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [geoAddress, setGeoAddress] = useState("");
  const [coordinatesText, setCoordinatesText] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [eventStatus, setEventStatus] = useState("draft");
  const [staff, setStaff] = useState<PlatformStaffMember[]>([]);
  const [eventManagerId, setEventManagerId] = useState("");
  const [eventOrganizerId, setEventOrganizerId] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    platformsAPI
      .myStaff()
      .then((res) => setStaff(res.data.staff ?? []))
      .catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    if (!isEdit || !eventId) return;
    setLoading(true);
    setError("");
    eventsAPI
      .get(eventId)
      .then((res) => {
        const d = res.data;
        setTitle(d.title);
        setVenue(d.venue ?? "");
        setDate(d.date);
        setStartTime(toTimeInput(d.time));
        setEndTime(toTimeInput(d.end_time));
        setGeoAddress(d.geo_address ?? "");
        if (d.latitude != null && d.longitude != null) {
          setLatitude(Number(d.latitude));
          setLongitude(Number(d.longitude));
          setCoordinatesText(`${d.latitude}, ${d.longitude}`);
        }
        setEventStatus(d.status ?? "draft");
        const mgrs = d.managers ?? [];
        setEventManagerId(mgrs[0] ? String(mgrs[0]) : "");
        setEventOrganizerId(mgrs.length > 1 ? String(mgrs[1]) : "");
        if (d.cover_image) {
          setCoverPreview(getMediaUrl(d.cover_image));
        }
      })
      .catch(() => setError("تعذّر تحميل بيانات المناسبة"))
      .finally(() => setLoading(false));
  }, [isEdit, eventId]);

  const managerOptions = useMemo(
    () => staff.filter((m) => m.role_key === "event_manager"),
    [staff]
  );

  const organizerOptions = useMemo(
    () => staff.filter((m) => m.role_key === "event_organizer"),
    [staff]
  );

  const applyCoordinates = useCallback((text: string) => {
    const parsed = parseCoordinateString(text);
    if (parsed) {
      setLatitude(parsed.lat);
      setLongitude(parsed.lng);
      setCoordinatesText(`${parsed.lat}, ${parsed.lng}`);
    }
  }, []);

  const handleCover = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم صورة الغلاف يجب ألا يتجاوز 5 ميغابايت");
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
    setError("");
  };

  const buildFormData = () => {
    const form = new FormData();
    form.append("title", title.trim());
    form.append("venue", venue.trim());
    form.append("date", date);
    form.append("time", startTime);
    if (endTime) {
      form.append("end_time", endTime);
      form.append("end_date", date);
    }
    form.append("geo_address", geoAddress.trim());
    if (latitude != null) form.append("latitude", String(latitude));
    if (longitude != null) form.append("longitude", String(longitude));
    form.append("status", isEdit ? eventStatus : "draft");
    if (coverFile) form.append("cover_image", coverFile);
    form.append("event_manager_id", eventManagerId);
    form.append("event_organizer_id", eventOrganizerId);
    return form;
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim()) {
      setError("اسم المناسبة مطلوب");
      return;
    }
    if (!date) {
      setError("تاريخ البدء مطلوب");
      return;
    }
    if (!startTime) {
      setError("وقت البدء مطلوب");
      return;
    }

    setSubmitting(true);
    try {
      const form = buildFormData();
      if (isEdit && eventId) {
        await eventsAPI.update(eventId, form);
      } else {
        await eventsAPI.create(form);
      }
      router.push("/platform/events");
    } catch (err: unknown) {
      const detail =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response
          ? err.response.data
          : null;
      const fallback = isEdit ? "فشل تحديث المناسبة" : "فشل إنشاء المناسبة";
      if (detail && typeof detail === "object") {
        const first = Object.values(detail).flat()[0];
        setError(typeof first === "string" ? first : fallback);
      } else {
        setError(`${fallback} — تحقق من الحقول`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !eventId) return;
    if (
      !window.confirm(
        `حذف المناسبة «${title}» نهائياً؟ سيتم حذف البيانات المرتبطة ولا يمكن التراجع.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await eventsAPI.delete(eventId);
      router.push("/platform/events");
    } catch {
      setError("تعذّر حذف المناسبة");
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link
            href="/platform/events"
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            العودة إلى المناسبات
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
            {isEdit ? "تعديل المناسبة" : "إضافة مناسبة"}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
            {isEdit
              ? "تحديث بيانات المرحلة الأولى — إعداد المناسبة. باقي المراحل تُكمل لاحقاً حسب الأدوار."
              : "المرحلة الأولى — إعداد المناسبة بواسطة مدير المنصة. باقي المراحل تُكمل لاحقاً حسب صلاحيات الأدوار."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || deleting}
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-6 py-3 rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary-container/25 disabled:opacity-50 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {submitting ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ المناسبة"}
        </button>
      </div>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
        <p className="text-xs font-bold text-on-surface-variant mb-3">
          مراحل المناسبة — كل مرحلة {EVENT_PHASE_WEIGHT}%
        </p>
        <div className="flex flex-wrap gap-2">
          {EVENT_PHASES.map((phase, index) => (
            <span
              key={phase.key}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                index === 0
                  ? "border-primary-container/50 bg-primary-container/15 text-primary"
                  : "border-outline-variant/20 text-outline opacity-60"
              }`}
            >
              <span className="material-symbols-outlined text-sm">{phase.icon}</span>
              {phase.label}
              <span className="text-[10px] opacity-70">({EVENT_PHASE_WEIGHT}%)</span>
              {index > 0 && (
                <span className="material-symbols-outlined text-[10px]">lock</span>
              )}
            </span>
          ))}
        </div>
      </section>

      {error && (
        <p className="text-sm px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </p>
      )}

      <section className="relative overflow-hidden rounded-3xl bg-surface-container-low p-6 sm:p-8 shadow-xl border border-outline-variant/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container/10 blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-tertiary-container/5 blur-[120px] -z-10 pointer-events-none" />

        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface mb-2">
            إعدادات المناسبة الأساسية
          </h2>
          <p className="text-on-surface-variant/80 text-sm max-w-2xl leading-relaxed">
            أدخل تفاصيل مجلسك أو مناسبتك. ستُستخدم هذه البيانات في بطاقات الدعوة والمنصة.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-5">
            <label className="block">
              <span className="text-sm font-semibold text-primary mb-2 block">اسم المناسبة</span>
              <div className="relative">
                <input
                  className={fieldInput("pr-12")}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: مجلس سعادة الشيخ فهد آل ثاني"
                />
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40">
                  edit
                </span>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-primary mb-2 block">الموقع</span>
              <div className="relative">
                <input
                  className={fieldInput("pr-12")}
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="مثال: قاعة الاحتفالات الرئيسية"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">
                  location_city
                </span>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-primary mb-2 block">
                  مدير الفعالية
                </span>
                <select
                  className={fieldInput()}
                  value={eventManagerId}
                  onChange={(e) => setEventManagerId(e.target.value)}
                >
                  <option value="">
                    {managerOptions.length === 0
                      ? "لا يوجد مدير فعالية — أضف عضو بهذا الدور"
                      : "اختر مدير الفعالية"}
                  </option>
                  {managerOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.role_label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-outline mt-1.5">
                  يظهر فقط أعضاء المنصة بدور «مدير فعالية»
                </p>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-primary mb-2 block">
                  منظم الفعالية
                </span>
                <select
                  className={fieldInput()}
                  value={eventOrganizerId}
                  onChange={(e) => setEventOrganizerId(e.target.value)}
                >
                  <option value="">
                    {organizerOptions.length === 0
                      ? "لا يوجد منظم فعالية — أضف عضو بهذا الدور"
                      : "اختر منظم الفعالية"}
                  </option>
                  {organizerOptions.map((m) => (
                    <option key={`org-${m.id}`} value={m.id}>
                      {m.name} — {m.role_label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-outline mt-1.5">
                  يظهر فقط أعضاء المنصة بدور «منظم فعالية»
                </p>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="block">
                <span className="text-sm font-semibold text-primary mb-2 block">تاريخ البدء</span>
                <input
                  className={fieldInput()}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-primary mb-2 block">وقت البدء</span>
                <input
                  className={fieldInput()}
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-primary mb-2 block">وقت الانتهاء</span>
                <input
                  className={fieldInput()}
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-primary mb-2 block">
                الموقع الجغرافي (نص)
              </span>
              <div className="relative">
                <input
                  className={fieldInput("pr-12")}
                  type="text"
                  value={geoAddress}
                  onChange={(e) => setGeoAddress(e.target.value)}
                  placeholder="قصر الوجبة، الدوحة - قطر"
                />
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary">
                  location_on
                </span>
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-primary mb-2 block">
                إحداثيات الموقع
              </span>
              <input
                className={fieldInput()}
                type="text"
                dir="ltr"
                value={coordinatesText}
                onChange={(e) => {
                  setCoordinatesText(e.target.value);
                  applyCoordinates(e.target.value);
                }}
                onBlur={() => applyCoordinates(coordinatesText)}
                placeholder="25.2854, 51.5310"
              />
              <p className="text-[11px] text-outline mt-1.5">
                الصق الإحداثيات (خط العرض، خط الطول) أو اختر من الخريطة
              </p>
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-primary mb-2">الخريطة</p>
            <GeoLocationMap
              latitude={latitude}
              longitude={longitude}
              onLocationChange={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
                setCoordinatesText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
              }}
              onAddressSuggestion={(label) => {
                if (!geoAddress.trim()) setGeoAddress(label);
              }}
            />
          </div>
        </div>
      </section>

      <section
        className="rounded-3xl border-2 border-dashed border-outline-variant/30 bg-surface-container-low p-6 sm:p-8 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith("image/")) handleCover(file);
        }}
      >
        <div className="flex flex-col items-center gap-4">
          {coverPreview ? (
            <img
              src={coverPreview}
              alt="معاينة الغلاف"
              className="w-full max-w-md h-48 object-cover rounded-2xl border border-outline-variant/20"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant/40">
              <span className="material-symbols-outlined text-4xl">cloud_upload</span>
            </div>
          )}
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-on-surface">صورة غلاف المناسبة</h3>
            <p className="text-on-surface-variant/70 text-sm mt-1 mb-4">
              اسحب وأفلت الصورة هنا أو اضغط للاختيار (JPG, PNG — بحد أقصى 5MB)
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="bg-surface-container-highest text-on-surface px-6 py-2.5 rounded-xl font-medium hover:bg-surface-bright transition-colors"
            >
              اختيار ملف
            </button>
            {coverPreview && (
              <button
                type="button"
                onClick={() => {
                  setCoverFile(null);
                  setCoverPreview(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-red-400 font-medium hover:underline text-sm"
              >
                حذف الصورة
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCover(file);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {isEdit && (
        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-400 shrink-0">warning</span>
              <div>
                <p className="text-sm font-bold text-red-300">حذف المناسبة</p>
                <p className="text-xs text-on-surface-variant mt-1 max-w-md">
                  يُحذف المناسبة وجميع البيانات المرتبطة بها نهائياً ولا يمكن استرجاعها.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || submitting}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-red-400 border border-red-500/30 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
            >
              <span className="material-symbols-outlined text-lg">delete_forever</span>
              {deleting ? "جاري الحذف..." : "حذف المناسبة نهائياً"}
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end pt-2">
        <Link
          href="/platform/events"
          className="px-8 py-3 rounded-2xl font-bold text-sm text-center text-on-surface-variant hover:bg-surface-container-high transition-all"
        >
          إلغاء
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || deleting}
          className="bg-gradient-to-br from-primary-container to-primary text-on-primary-container px-10 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary-container/30 hover:brightness-110 transition-all disabled:opacity-50"
        >
          {submitting
            ? "جاري الحفظ..."
            : isEdit
              ? "تحديث المناسبة"
              : "إنشاء المناسبة"}
        </button>
      </div>
    </div>
  );
}
