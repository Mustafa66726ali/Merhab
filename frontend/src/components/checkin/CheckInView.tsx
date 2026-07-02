"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { guestsAPI, type EventGuestRow } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import QrScanner from "@/components/common/QrScanner";
import { extractGuestScanToken, isCameraContextSecure } from "@/lib/camera";

type ListResponse = EventGuestRow[] | { results?: EventGuestRow[] };

function normalize(data: ListResponse): EventGuestRow[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

interface CheckInViewProps {
  /** المسار الذي يُعاد إليه المستخدم إن لم يملك صلاحية مسح QR. */
  redirectPath: string;
  /** وصف الصفحة أسفل العنوان. */
  description?: string;
}

export default function CheckInView({
  redirectPath,
  description = "ابحث عن الضيف بالاسم أو الرقم وسجّل حضوره فوراً.",
}: CheckInViewProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  const canScan = !!user?.membership?.perm_scan_qr;

  const [guests, setGuests] = useState<EventGuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [lastScanned, setLastScanned] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [manualPending, setManualPending] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);

  useEffect(() => {
    setCameraBlocked(!isCameraContextSecure());
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    guestsAPI
      .list({ page_size: 500 })
      .then((r) => setGuests(normalize(r.data as ListResponse)))
      .catch(() => setGuests([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!canScan) {
      router.replace(redirectPath);
      return;
    }
    load();
  }, [canScan, load, router, redirectPath]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) =>
      [g.full_name, g.email, g.phone, String(g.id)].join(" ").toLowerCase().includes(q)
    );
  }, [guests, search]);

  const stats = useMemo(() => {
    const total = guests.length;
    const attended = guests.filter(
      (g) => g.status === "attended" || g.status === "seated"
    ).length;
    return { total, attended, remaining: total - attended };
  }, [guests]);

  const handleScan = async (token: string) => {
    const normalized = extractGuestScanToken(token);
    try {
      const res = await guestsAPI.scan(normalized);
      const g = res.data;
      setGuests((prev) =>
        prev.map((x) =>
          x.id === g.id
            ? { ...x, status: g.status, status_label: g.status_label }
            : x
        )
      );
      const msg = res.data.already_checked_in
        ? `${g.full_name} مُسجّل حضوره مسبقاً`
        : `تم تسجيل حضور ${g.full_name}`;
      setLastScanned(msg);
      setToast({ type: "ok", msg });
    } catch {
      const msg = "رمز غير صالح أو خارج نطاق صلاحياتك";
      setLastScanned(msg);
      setToast({ type: "err", msg });
    }
  };

  const handleManualScan = async () => {
    const raw = manualToken.trim();
    if (!raw) return;
    setManualPending(true);
    try {
      await handleScan(raw);
      setManualToken("");
    } finally {
      setManualPending(false);
    }
  };

  const handleCheckIn = async (guest: EventGuestRow) => {
    if (guest.status === "attended") return;
    setPendingId(guest.id);
    try {
      await guestsAPI.checkIn(guest.id);
      setGuests((prev) =>
        prev.map((g) =>
          g.id === guest.id ? { ...g, status: "attended", status_label: "حضر" } : g
        )
      );
      setToast({ type: "ok", msg: `تم تسجيل حضور ${guest.full_name}` });
    } catch {
      setToast({ type: "err", msg: "تعذّر تسجيل الحضور — تحقق من صلاحياتك" });
    } finally {
      setPendingId(null);
    }
  };

  if (!canScan) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface">تسجيل الحضور</h1>
        <p className="text-on-surface-variant mt-2">{description}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-4">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            إجمالي الضيوف
          </p>
          <p className="text-2xl font-black text-on-surface tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-4">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            حضروا
          </p>
          <p className="text-2xl font-black text-green-400 tabular-nums">{stats.attended}</p>
        </div>
        <div className="rounded-2xl bg-surface-container-low border border-outline-variant/10 p-4">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            المتبقّون
          </p>
          <p className="text-2xl font-black text-primary tabular-nums">{stats.remaining}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={search}
            autoFocus
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم / الرقم / البريد..."
            className="w-full h-14 pr-12 pl-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        {!cameraBlocked && (
          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="h-14 px-6 inline-flex items-center justify-center gap-2 bg-primary text-on-primary rounded-2xl font-bold text-sm hover:brightness-110 transition-all shrink-0"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            مسح بالكاميرا
          </button>
        )}
      </div>

      {cameraBlocked && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="font-bold">الكاميرا غير متاحة عبر HTTP من جهاز آخر</p>
          <p className="text-xs mt-1 text-amber-200/90">
            افتح الموقع عبر <span dir="ltr">https://</span> (بعد إعادة تشغيل المشروع) أو
            أدخل رمز الضيف يدوياً / سجّل الحضور من القائمة.
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={manualToken}
          onChange={(e) => setManualToken(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleManualScan()}
          placeholder="رمز الضيف أو رابط الدعوة (للإدخال اليدوي)"
          dir="ltr"
          className="flex-1 h-12 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="button"
          onClick={handleManualScan}
          disabled={!manualToken.trim() || manualPending}
          className="h-12 px-5 inline-flex items-center justify-center gap-2 bg-surface-container-highest text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container-highest/80 transition disabled:opacity-50 shrink-0"
        >
          {manualPending ? (
            <span className="animate-spin w-4 h-4 border-2 border-on-surface border-t-transparent rounded-full" />
          ) : (
            <span className="material-symbols-outlined text-base">pin</span>
          )}
          تسجيل بالرمز
        </button>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant text-sm">
            {guests.length === 0 ? "لا يوجد ضيوف على فعالياتك" : "لا توجد نتائج مطابقة"}
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant/5">
            {filtered.map((g) => {
              const attended = g.status === "attended" || g.status === "seated";
              return (
                <li key={g.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary font-bold shrink-0">
                    {(g.full_name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-on-surface text-sm truncate">{g.full_name}</p>
                    <p className="text-xs text-on-surface-variant truncate" dir="ltr">
                      {g.phone || g.email || `#${g.id}`}
                    </p>
                  </div>
                  {attended ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-500/15 text-green-400 text-xs font-bold shrink-0">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>
                      {g.status === "seated" ? "جلس" : "حضر"}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleCheckIn(g)}
                      disabled={pendingId === g.id}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition disabled:opacity-50 shrink-0"
                    >
                      {pendingId === g.id ? (
                        <span className="animate-spin w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full" />
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
                      )}
                      تسجيل حضور
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-lg ${
            toast.type === "ok"
              ? "bg-green-500/90 text-white"
              : "bg-red-500/90 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <QrScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onResult={handleScan}
        title="مسح حضور الضيف"
        subtitle="وجّه الكاميرا نحو رمز QR الخاص بالضيف"
        hint={lastScanned}
      />
    </div>
  );
}
