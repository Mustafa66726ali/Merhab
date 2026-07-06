"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatPhoneDisplay } from "@/components/common/PhoneNumberField";
import {
  guestStatusClass,
  guestStatusDotClass,
} from "@/components/events/guestStatus";
import { guestsAPI, type EventGuestDetail } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface GuestDetailViewProps {
  guestId: number;
  guestsBasePath: string;
  eventsBasePath: string;
}

function guestInitial(name: string) {
  const t = name.trim();
  return t ? t[0] : "?";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function GuestDetailView({
  guestId,
  guestsBasePath,
  eventsBasePath,
}: GuestDetailViewProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "event_manager" ||
    user?.role === "platform_admin" ||
    user?.role === "event_organizer";

  const [guest, setGuest] = useState<EventGuestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    setLoading(true);
    guestsAPI
      .get(guestId)
      .then((res) => setGuest(res.data))
      .catch(() => setError("تعذّر تحميل بيانات الضيف."))
      .finally(() => setLoading(false));
  }, [guestId]);

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      await guestsAPI.delete(guestId);
      router.push(guestsBasePath);
    } catch {
      setError("تعذّر حذف الضيف.");
      setDeleting(false);
      setDeleteConfirm(false);
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
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6">
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant flex-wrap">
        <Link href={guestsBasePath} className="hover:text-primary transition-colors">
          الضيوف
        </Link>
        <span className="material-symbols-outlined text-base">chevron_left</span>
        <span className="text-on-surface font-medium">{guest.full_name}</span>
      </nav>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center text-primary text-2xl font-black shrink-0">
            {guestInitial(guest.full_name)}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-on-surface tracking-tight">
              {guest.full_name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${guestStatusClass(guest.status)}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${guestStatusDotClass(guest.status)}`}
                />
                {guest.status_label}
              </span>
              <span className="text-xs text-on-surface-variant">
                أُضيف {formatDate(guest.created_at)}
              </span>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <Link
              href={`${guestsBasePath}/${guestId}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/25 bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-all"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
              تعديل
            </Link>
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 font-bold text-sm hover:bg-red-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
              حذف
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
            معلومات الاتصال
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">البريد</dt>
              <dd className="text-on-surface font-medium text-left" dir="ltr">
                {guest.email || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">الجوال</dt>
              <dd className="text-on-surface font-medium text-left" dir="ltr">
                {guest.phone ? formatPhoneDisplay(guest.phone) : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-4">
          <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
            المناسبة والتصنيف
          </h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">المناسبة</dt>
              <dd>
                <Link
                  href={`${eventsBasePath}/${guest.event}`}
                  className="text-primary font-bold hover:underline"
                >
                  {guest.event_title}
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">القسم</dt>
              <dd className="text-on-surface font-medium">
                {guest.section_name || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">المجموعة</dt>
              <dd className="text-on-surface font-medium">
                {guest.group_name || "—"}
              </dd>
            </div>
          </dl>
        </div>

        {guest.greeting && (
          <div className="lg:col-span-2 bg-surface-container-low rounded-2xl border border-emerald-500/20 p-5 sm:p-6 space-y-2">
            <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-base">celebration</span>
              كلمة تهنئة من الضيف
            </h2>
            <p className="text-sm text-on-surface whitespace-pre-wrap arabic-display">{guest.greeting}</p>
          </div>
        )}

        {(guest.notes || guest.dietary_requirements) && (
          <div className="lg:col-span-2 bg-surface-container-low rounded-2xl border border-outline-variant/10 p-5 sm:p-6 space-y-4">
            <h2 className="text-sm font-bold text-on-surface-variant uppercase tracking-widest">
              ملاحظات إضافية
            </h2>
            {guest.notes && (
              <div>
                <p className="text-xs text-on-surface-variant mb-1">ملاحظات</p>
                <p className="text-sm text-on-surface whitespace-pre-wrap">{guest.notes}</p>
              </div>
            )}
            {guest.dietary_requirements && (
              <div>
                <p className="text-xs text-on-surface-variant mb-1">متطلبات غذائية</p>
                <p className="text-sm text-on-surface whitespace-pre-wrap">
                  {guest.dietary_requirements}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-on-surface">حذف الضيف</h2>
            <p className="text-sm text-on-surface-variant">
              هل أنت متأكد من حذف «{guest.full_name}»؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl border border-outline-variant/25 text-on-surface text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
