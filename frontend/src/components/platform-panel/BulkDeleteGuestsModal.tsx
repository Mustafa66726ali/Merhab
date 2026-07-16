"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GUEST_STATUS_OPTIONS,
  guestStatusClass,
} from "@/components/events/guestStatus";
import type { EventGuestRow } from "@/lib/api";

function guestInitial(name: string) {
  const t = name.trim();
  return t ? t[0] : "?";
}

function statusLabel(status: string) {
  return GUEST_STATUS_OPTIONS.find((o) => o.value === status)?.label || status;
}

interface BulkDeleteGuestsModalProps {
  open: boolean;
  guests: EventGuestRow[];
  showEventColumn?: boolean;
  deleting?: boolean;
  onClose: () => void;
  onConfirm: (ids: number[]) => void;
}

export default function BulkDeleteGuestsModal({
  open,
  guests,
  showEventColumn = false,
  deleting = false,
  onClose,
  onConfirm,
}: BulkDeleteGuestsModalProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState("");
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(new Set());
    setQuery("");
    setConfirmStep(false);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter((g) => {
      const hay = [
        g.full_name,
        g.phone,
        g.email,
        g.event_title,
        g.section_name,
        g.group_name,
        g.status_label,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [guests, query]);

  const selectedCount = selected.size;
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((g) => selected.has(g.id));
  const someFilteredSelected = filtered.some((g) => selected.has(g.id));

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((g) => next.delete(g.id));
      } else {
        filtered.forEach((g) => next.add(g.id));
      }
      return next;
    });
  };

  const selectedGuests = useMemo(
    () => guests.filter((g) => selected.has(g.id)),
    [guests, selected]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-delete-title"
      onClick={() => !deleting && onClose()}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-outline-variant/20 bg-surface-container-low shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-outline-variant/10 bg-gradient-to-l from-rose-500/10 via-transparent to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-500/15 text-rose-400 grid place-items-center shrink-0">
                <span className="material-symbols-outlined text-2xl">
                  group_remove
                </span>
              </div>
              <div className="min-w-0">
                <h2
                  id="bulk-delete-title"
                  className="text-lg sm:text-xl font-black text-on-surface tracking-tight"
                >
                  {confirmStep ? "تأكيد الحذف الجماعي" : "حذف الضيوف"}
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  {confirmStep
                    ? `سيتم حذف ${selectedCount} ضيفاً نهائياً دون إمكانية التراجع.`
                    : "حدّد الضيوف المراد حذفهم، أو اختر الكل من القائمة الحالية."}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={deleting}
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
              aria-label="إغلاق"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {!confirmStep ? (
          <>
            {/* Toolbar */}
            <div className="shrink-0 px-4 sm:px-6 py-3 space-y-3 border-b border-outline-variant/10">
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-on-surface-variant/50">
                  <span className="material-symbols-outlined text-lg">search</span>
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الجوال أو القسم..."
                  className="w-full h-11 pr-10 pl-3 rounded-xl bg-surface-container-high/80 border border-outline-variant/15 text-sm text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  disabled={filtered.length === 0}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 bg-surface-container-high/60 text-on-surface hover:bg-surface-container-highest transition-colors disabled:opacity-40"
                >
                  <span
                    className={`material-symbols-outlined text-base ${
                      allFilteredSelected
                        ? "text-primary"
                        : someFilteredSelected
                          ? "text-amber-400"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {allFilteredSelected
                      ? "check_box"
                      : someFilteredSelected
                        ? "indeterminate_check_box"
                        : "check_box_outline_blank"}
                  </span>
                  {allFilteredSelected ? "إلغاء تحديد الظاهر" : "تحديد الكل الظاهر"}
                </button>
                <div className="flex items-center gap-2 text-[11px] sm:text-xs">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-bold">
                    الظاهر {filtered.length}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold ${
                      selectedCount
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    المحدد {selectedCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 sm:px-3 py-2">
              {guests.length === 0 ? (
                <div className="py-16 text-center text-sm text-on-surface-variant">
                  لا يوجد ضيوف في القائمة الحالية.
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-sm text-on-surface-variant">
                  لا توجد نتائج مطابقة للبحث.
                </div>
              ) : (
                <ul className="space-y-1.5 pb-2">
                  {filtered.map((g) => {
                    const isOn = selected.has(g.id);
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => toggleOne(g.id)}
                          className={`w-full text-right flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all border ${
                            isOn
                              ? "bg-rose-500/10 border-rose-500/30 ring-1 ring-rose-500/20"
                              : "bg-surface-container-high/40 border-transparent hover:bg-surface-container-high"
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-xl shrink-0 ${
                              isOn ? "text-rose-400" : "text-on-surface-variant/60"
                            }`}
                          >
                            {isOn ? "check_box" : "check_box_outline_blank"}
                          </span>
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              isOn
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-primary/10 text-primary"
                            }`}
                          >
                            {guestInitial(g.full_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-on-surface truncate">
                              {g.full_name}
                            </p>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                              {[
                                g.phone || null,
                                showEventColumn ? g.event_title : null,
                                g.section_name || null,
                                g.group_name || null,
                              ]
                                .filter(Boolean)
                                .join(" · ") || "بدون تفاصيل إضافية"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg ${guestStatusClass(g.status)}`}
                          >
                            {g.status_label || statusLabel(g.status)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3">
            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 leading-relaxed">
              تحذير: الحذف نهائي ويشمل بيانات الضيف المرتبطة بهذه المناسبة
              (بما في ذلك جدولة التذكير وQR إن وُجدت).
            </div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              الضيوف المحددون ({selectedGuests.length})
            </p>
            <ul className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-0.5">
              {selectedGuests.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-container-high/70"
                >
                  <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-300 grid place-items-center text-xs font-bold shrink-0">
                    {guestInitial(g.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {g.full_name}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate" dir="ltr">
                      {g.phone || "—"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t border-outline-variant/10 bg-surface-container-lowest/40 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          {!confirmStep ? (
            <>
              <button
                type="button"
                disabled={deleting}
                onClick={onClose}
                className="h-11 px-5 rounded-xl border border-outline-variant/25 text-on-surface text-sm font-bold hover:bg-surface-container-high transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={selectedCount === 0 || deleting}
                onClick={() => setConfirmStep(true)}
                className="h-11 px-5 rounded-xl bg-rose-500 text-white text-sm font-bold hover:brightness-110 disabled:opacity-45 transition-all inline-flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                متابعة حذف {selectedCount || ""}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmStep(false)}
                className="h-11 px-5 rounded-xl border border-outline-variant/25 text-on-surface text-sm font-bold hover:bg-surface-container-high transition-colors"
              >
                رجوع للتحديد
              </button>
              <button
                type="button"
                disabled={deleting || selectedCount === 0}
                onClick={() => onConfirm(Array.from(selected))}
                className="h-11 px-5 rounded-xl bg-rose-600 text-white text-sm font-bold hover:brightness-110 disabled:opacity-45 transition-all inline-flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">
                      delete_forever
                    </span>
                    تأكيد حذف {selectedCount}
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
