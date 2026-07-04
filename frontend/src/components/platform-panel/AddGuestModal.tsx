"use client";

import type { EventDetail, GuestDirectoryEntry } from "@/lib/api";
import PhoneNumberField, { formatPhoneDisplay } from "@/components/common/PhoneNumberField";

interface SelectOption {
  value: string;
  label: string;
}

export interface AddGuestFormState {
  mode: "new" | "existing";
  existingGuestId: string;
  full_name: string;
  email: string;
  phone: string;
  eventId: string;
  sectionId: string;
  groupId: string;
}

interface AddGuestModalProps {
  open: boolean;
  saving: boolean;
  isEventScope: boolean;
  eventTitle?: string;
  eventOptions: { id: number; title: string }[];
  form: AddGuestFormState;
  onFormChange: (patch: Partial<AddGuestFormState>) => void;
  sectionOptions: SelectOption[];
  groupOptions: SelectOption[];
  eventForSections: EventDetail | null | undefined;
  directoryGuests: GuestDirectoryEntry[];
  directoryLoading?: boolean;
  onDirectorySearch?: (query: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-bold text-on-surface-variant mb-1.5 tracking-wide">
      {children}
    </label>
  );
}

function FieldShell({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
        {icon}
      </span>
      {children}
    </div>
  );
}

const inputClass =
  "w-full pr-11 pl-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-container/40 transition-all";

export default function AddGuestModal({
  open,
  saving,
  isEventScope,
  eventTitle,
  eventOptions,
  form,
  onFormChange,
  sectionOptions,
  groupOptions,
  eventForSections,
  directoryGuests,
  directoryLoading = false,
  onDirectorySearch,
  onClose,
  onSubmit,
}: AddGuestModalProps) {
  if (!open) return null;

  const selectedEventTitle =
    isEventScope
      ? eventTitle
      : eventOptions.find((e) => String(e.id) === form.eventId)?.title;

  const selectedSection = sectionOptions.find((s) => s.value === form.sectionId);
  const selectedGroup = groupOptions.find((g) => g.value === form.groupId);

  const hasPreview =
    form.full_name.trim() ||
    selectedEventTitle ||
    selectedSection ||
    selectedGroup;

  const selectedExisting = directoryGuests.find(
    (g) => String(g.id) === form.existingGuestId
  );

  const canSubmit =
    form.mode === "existing"
      ? Boolean(form.existingGuestId)
      : Boolean(form.full_name.trim());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/65 backdrop-blur-sm"
      onClick={() => !saving && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-guest-title"
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[min(90vh,720px)] flex flex-col rounded-t-2xl sm:rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl shadow-black/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 relative px-4 sm:px-6 pt-5 pb-4 border-b border-outline-variant/10 bg-gradient-to-br from-primary-container/15 via-surface-container-low to-surface-container-low">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 border border-primary-container/25">
                <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
              </div>
              <div className="min-w-0">
                <h2
                  id="add-guest-title"
                  className="font-headline text-lg sm:text-xl font-extrabold text-on-surface"
                >
                  إضافة ضيف
                </h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                  أدخل بيانات الضيف واختر القسم والمجموعة إن وُجدت
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors shrink-0 disabled:opacity-50"
              aria-label="إغلاق"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-5 min-h-0">
          {hasPreview && (
            <div className="rounded-2xl border border-primary-container/25 bg-gradient-to-br from-primary-container/10 to-surface-container-high/80 p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                معاينة التفاصيل
              </p>
              {form.full_name.trim() && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary font-bold shrink-0">
                    {form.full_name.trim()[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{form.full_name}</p>
                    {(form.email || form.phone) && (
                      <p className="text-xs text-on-surface-variant truncate">
                        {[form.email, form.phone ? formatPhoneDisplay(form.phone) : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {selectedEventTitle && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-high border border-outline-variant/15 text-[11px] font-bold text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm text-outline">event</span>
                    {selectedEventTitle}
                  </span>
                )}
                {selectedSection && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-tertiary-container/10 border border-tertiary/20 text-[11px] font-bold text-tertiary">
                    <span className="material-symbols-outlined text-sm">grid_view</span>
                    {selectedSection.label}
                  </span>
                )}
                {selectedGroup && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-container/10 border border-primary-container/20 text-[11px] font-bold text-primary">
                    <span className="material-symbols-outlined text-sm">groups</span>
                    {selectedGroup.label}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* المناسبة */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">event</span>
              <h3 className="text-sm font-bold text-on-surface">المناسبة</h3>
            </div>
            {isEventScope ? (
              <div className="rounded-xl border border-outline-variant/10 bg-surface-container-high/60 px-4 py-3">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                  الفعالية
                </p>
                <p className="font-bold text-on-surface text-sm">{eventTitle || "—"}</p>
              </div>
            ) : (
              <FieldShell icon="event">
                <select
                  value={form.eventId}
                  onChange={(e) =>
                    onFormChange({ eventId: e.target.value, sectionId: "", groupId: "" })
                  }
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="">اختر المناسبة</option>
                  {eventOptions.map((e) => (
                    <option key={e.id} value={String(e.id)}>{e.title}</option>
                  ))}
                </select>
              </FieldShell>
            )}
          </section>

          {/* طريقة الإضافة */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">swap_horiz</span>
              <h3 className="text-sm font-bold text-on-surface">طريقة الإضافة</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onFormChange({ mode: "new", existingGuestId: "" })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  form.mode === "new"
                    ? "bg-primary-container/20 border-primary-container/40 text-primary"
                    : "bg-surface-container-high border-outline-variant/15 text-on-surface-variant"
                }`}
              >
                ضيف جديد
              </button>
              <button
                type="button"
                onClick={() => onFormChange({ mode: "existing" })}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors ${
                  form.mode === "existing"
                    ? "bg-primary-container/20 border-primary-container/40 text-primary"
                    : "bg-surface-container-high border-outline-variant/15 text-on-surface-variant"
                }`}
              >
                من مناسبة سابقة
              </button>
            </div>
            {form.mode === "existing" && (
              <div className="space-y-2 rounded-2xl border border-outline-variant/10 bg-surface-container-high/30 p-4">
                <FieldLabel>اختر ضيفاً مُسجّلاً سابقاً</FieldLabel>
                <FieldShell icon="person_search">
                  <input
                    type="search"
                    placeholder="ابحث بالاسم أو الجوال أو البريد..."
                    className={inputClass}
                    onChange={(e) => onDirectorySearch?.(e.target.value)}
                  />
                </FieldShell>
                <div className="max-h-44 overflow-y-auto space-y-1.5 mt-2">
                  {directoryLoading ? (
                    <p className="text-xs text-on-surface-variant text-center py-4">جاري التحميل...</p>
                  ) : directoryGuests.length === 0 ? (
                    <p className="text-xs text-on-surface-variant text-center py-4">
                      لا يوجد ضيوف في مناسبات أخرى بعد
                    </p>
                  ) : (
                    directoryGuests.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() =>
                          onFormChange({
                            existingGuestId: String(g.id),
                            full_name: g.full_name,
                            email: g.email,
                            phone: g.phone,
                          })
                        }
                        className={`w-full text-right rounded-xl border px-3 py-2.5 transition-colors ${
                          form.existingGuestId === String(g.id)
                            ? "border-primary-container/50 bg-primary-container/15"
                            : "border-outline-variant/10 bg-surface-container-high hover:border-outline-variant/25"
                        }`}
                      >
                        <p className="font-bold text-sm text-on-surface">{g.full_name}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {[g.phone ? formatPhoneDisplay(g.phone) : "", g.email]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                        <p className="text-[10px] text-outline mt-1">
                          {g.event_count > 1
                            ? `${g.event_count} مناسبات`
                            : g.last_event_title}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                {selectedExisting && (
                  <p className="text-xs text-primary mt-2">
                    سيُضاف {selectedExisting.full_name} كضيف جديد في هذه المناسبة (دعوة ورمز QR مستقلان).
                  </p>
                )}
              </div>
            )}
          </section>

          {/* البيانات الشخصية */}
          {form.mode === "new" && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">badge</span>
              <h3 className="text-sm font-bold text-on-surface">البيانات الشخصية</h3>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>الاسم الكامل *</FieldLabel>
                <FieldShell icon="person">
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => onFormChange({ full_name: e.target.value })}
                    placeholder="الاسم كما سيظهر في الدعوة"
                    className={inputClass}
                    autoFocus
                  />
                </FieldShell>
              </div>
              <div className="space-y-3">
                <div>
                  <FieldLabel>البريد الإلكتروني</FieldLabel>
                  <FieldShell icon="mail">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => onFormChange({ email: e.target.value })}
                      placeholder="example@email.com"
                      className={inputClass}
                    />
                  </FieldShell>
                </div>
                <div>
                  <FieldLabel>رقم الجوال</FieldLabel>
                  <PhoneNumberField
                    value={form.phone}
                    onChange={(phone) => onFormChange({ phone })}
                    placeholder="5xxxxxxxx"
                  />
                </div>
              </div>
            </div>
          </section>
          )}

          {form.mode === "existing" && selectedExisting && (
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-high/40 p-4">
              <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">
                بيانات الضيف المختار
              </p>
              <p className="font-bold text-on-surface">{selectedExisting.full_name}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {[selectedExisting.phone ? formatPhoneDisplay(selectedExisting.phone) : "", selectedExisting.email]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
          )}

          {/* التوزيع */}
          {(sectionOptions.length > 0 || groupOptions.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">grid_view</span>
                <h3 className="text-sm font-bold text-on-surface">التوزيع على الأقسام</h3>
              </div>
              <div className="space-y-3 rounded-2xl border border-outline-variant/10 bg-surface-container-high/30 p-4">
                {sectionOptions.length > 0 && (
                  <div>
                    <FieldLabel>القسم</FieldLabel>
                    <FieldShell icon="category">
                      <select
                        value={form.sectionId}
                        onChange={(e) =>
                          onFormChange({ sectionId: e.target.value, groupId: "" })
                        }
                        className={`${inputClass} appearance-none cursor-pointer`}
                      >
                        <option value="">بدون قسم</option>
                        {sectionOptions.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </FieldShell>
                  </div>
                )}
                {groupOptions.length > 0 && (
                  <div>
                    <FieldLabel>المجموعة</FieldLabel>
                    <FieldShell icon="groups">
                      <select
                        value={form.groupId}
                        onChange={(e) => onFormChange({ groupId: e.target.value })}
                        className={`${inputClass} appearance-none cursor-pointer`}
                      >
                        <option value="">بدون مجموعة</option>
                        {groupOptions.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </FieldShell>
                  </div>
                )}
                {eventForSections?.sections?.length === 0 && (
                  <p className="text-xs text-on-surface-variant text-center py-2">
                    لا توجد أقسام لهذه المناسبة بعد
                  </p>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 flex flex-col sm:flex-row gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t border-outline-variant/10 bg-surface-container-low/95 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border border-outline-variant/25 text-on-surface-variant font-bold text-sm hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || !canSubmit}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50 shadow-lg shadow-primary-container/20"
          >
            {saving ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-on-primary-container border-t-transparent rounded-full" />
                جاري الإضافة...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">check</span>
                إضافة الضيف
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
