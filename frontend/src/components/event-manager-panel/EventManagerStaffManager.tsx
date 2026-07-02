"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  platformsAPI,
  type EventManagerStaffRow,
  type EventManagerStaffCreatePayload,
} from "@/lib/api";

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role_key: "coordinator" | "entry_manager";
  coordinator_label: string;
}

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  password: "",
  role_key: "coordinator",
  coordinator_label: "منسق رجال",
};

function apiError(e: unknown, fallback: string): string {
  const data = (e as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (data) {
    const first = Object.values(data)[0];
    if (typeof first === "string") return first;
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    if (typeof data.detail === "string") return data.detail;
  }
  return fallback;
}

export default function EventManagerStaffManager() {
  const [staff, setStaff] = useState<EventManagerStaffRow[]>([]);
  const [platformEvents, setPlatformEvents] = useState<{ id: number; title: string }[]>([]);
  const [stats, setStats] = useState({ total: 0, coordinators: 0, entry_managers: 0 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<EventManagerStaffRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [assigningEventId, setAssigningEventId] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    platformsAPI
      .myStaffTeam()
      .then((r) => {
        setStaff(r.data.staff);
        setStats(r.data.stats);
        setPlatformEvents(r.data.platform_events ?? []);
      })
      .catch(() => {
        setStaff([]);
        setPlatformEvents([]);
        setStats({ total: 0, coordinators: 0, entry_managers: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const updateStaffRow = (updated: EventManagerStaffRow) => {
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    setAssignTarget((prev) => (prev?.id === updated.id ? updated : prev));
  };

  const openModal = () => {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!form.email.trim() || !form.password.trim()) {
      setFormError("البريد وكلمة المرور مطلوبان");
      return;
    }
    if (form.password.trim().length < 6) {
      setFormError("كلمة المرور يجب ألا تقل عن 6 أحرف");
      return;
    }
    if (form.role_key === "coordinator" && !form.coordinator_label.trim()) {
      setFormError("يرجى تحديد نوع المنسق (مثال: منسق رجال)");
      return;
    }
    setSaving(true);
    try {
      const payload: EventManagerStaffCreatePayload = {
        email: form.email.trim().toLowerCase(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password.trim(),
        role_key: form.role_key,
        coordinator_label:
          form.role_key === "coordinator" ? form.coordinator_label.trim() : "",
      };
      await platformsAPI.myStaffTeamAdd(payload);
      setModalOpen(false);
      setToast({ type: "ok", msg: "تم إنشاء الحساب — عيّنه الآن على فعالية ليصل لصلاحياته" });
      load();
    } catch (err) {
      setFormError(apiError(err, "تعذّر إنشاء الحساب"));
    } finally {
      setSaving(false);
    }
  };

  const assignEvent = async (userId: number, eventId: number) => {
    setAssigningEventId(eventId);
    try {
      const res = await platformsAPI.myStaffTeamAssignEvent(userId, eventId);
      updateStaffRow(res.data);
      setToast({ type: "ok", msg: "تم التعيين على الفعالية" });
    } catch (err) {
      setToast({ type: "err", msg: apiError(err, "تعذّر التعيين") });
    } finally {
      setAssigningEventId(null);
    }
  };

  const unassignEvent = async (userId: number, eventId: number) => {
    setAssigningEventId(eventId);
    try {
      const res = await platformsAPI.myStaffTeamUnassignEvent(userId, eventId);
      updateStaffRow(res.data);
      setToast({ type: "ok", msg: "تم إلغاء التعيين" });
    } catch (err) {
      setToast({ type: "err", msg: apiError(err, "تعذّر إلغاء التعيين") });
    } finally {
      setAssigningEventId(null);
    }
  };

  const remove = async (row: EventManagerStaffRow) => {
    if (!confirm(`إزالة حساب ${row.name}؟`)) return;
    setRemovingId(row.id);
    try {
      await platformsAPI.myStaffTeamRemove(row.id);
      setToast({ type: "ok", msg: "تمت الإزالة" });
      setStaff((prev) => prev.filter((s) => s.id !== row.id));
    } catch (err) {
      setToast({ type: "err", msg: apiError(err, "تعذّرت الإزالة") });
    } finally {
      setRemovingId(null);
    }
  };

  const kpis = useMemo(
    () => [
      { label: "إجمالي الطاقم", value: stats.total, tone: "text-on-surface" },
      { label: "المنسقون", value: stats.coordinators, tone: "text-primary" },
      { label: "مدراء الدخول", value: stats.entry_managers, tone: "text-tertiary" },
    ],
    [stats]
  );

  const unassignedEventsFor = (row: EventManagerStaffRow) => {
    const assignedIds = new Set((row.assigned_events ?? []).map((e) => e.id));
    return platformEvents.filter((e) => !assignedIds.has(e.id));
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
            المنسقون ومدراء الدخول
          </h1>
          <p className="text-sm text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
            أنشئ حسابات المنسقين ومدراء الدخول، ثم عيّن كل عضو على فعاليات محددة — لا يصل
            لصلاحيات الإجلاس أو مسح الحضور إلا بعد التعيين على تلك الفعالية.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 h-12 px-5 bg-primary text-on-primary rounded-2xl font-bold text-sm hover:brightness-110 transition-all shrink-0"
        >
          <span className="material-symbols-outlined">person_add</span>
          إضافة عضو
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-4 sm:p-5"
          >
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
              {k.label}
            </p>
            <p className={`text-2xl font-black tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface-container-low rounded-2xl sm:rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-9 h-9 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant text-sm">
            لا يوجد منسقون أو مدراء دخول بعد — أضف أول عضو من زر «إضافة عضو».
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[860px]">
              <thead>
                <tr className="bg-surface-container-highest/30">
                  <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    الاسم
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    البريد
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    الدور
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    الفعاليات المعيّنة
                  </th>
                  <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                    إجراء
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {staff.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary font-bold shrink-0">
                          {row.avatar_initial}
                        </div>
                        <span className="font-bold text-on-surface text-sm truncate">
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-on-surface-variant" dir="ltr">
                      {row.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold ${
                          row.role_key === "coordinator"
                            ? "bg-primary-container/15 text-primary border border-primary/25"
                            : "bg-tertiary/15 text-tertiary border border-tertiary/25"
                        }`}
                      >
                        {row.role_label}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {(row.assigned_events ?? []).length === 0 ? (
                        <span className="text-xs text-amber-400 font-bold">لم يُعيَّن بعد</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                          {(row.assigned_events ?? []).map((ev) => (
                            <span
                              key={ev.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container-highest text-[10px] font-bold text-on-surface"
                            >
                              <span className="truncate max-w-[120px]">{ev.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAssignTarget(row)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition"
                        >
                          <span className="material-symbols-outlined text-[16px]">event</span>
                          تعيين
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(row)}
                          disabled={removingId === row.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition disabled:opacity-50"
                        >
                          {removingId === row.id ? (
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full" />
                          ) : (
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          )}
                          إزالة
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !saving && setModalOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-surface-container rounded-t-3xl sm:rounded-3xl border border-outline-variant/15 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 sticky top-0 bg-surface-container">
              <h2 className="font-bold text-on-surface">إضافة عضو طاقم</h2>
              <button
                type="button"
                onClick={() => !saving && setModalOpen(false)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={submit} className="p-6 space-y-4">
              {formError && (
                <div className="text-sm p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  الدور
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "coordinator", label: "منسق", icon: "event_seat" },
                    { value: "entry_manager", label: "مدير دخول", icon: "qr_code_scanner" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, role_key: opt.value }))}
                      className={`flex items-center justify-center gap-2 h-12 rounded-xl border text-sm font-bold transition ${
                        form.role_key === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant/20 text-on-surface-variant hover:border-primary/40"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {form.role_key === "coordinator" && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    نوع المنسق
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["منسق رجال", "منسق نساء"].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, coordinator_label: label }))}
                        className={`h-11 rounded-xl border text-sm font-bold transition ${
                          form.coordinator_label === label
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-outline-variant/20 text-on-surface-variant hover:border-primary/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={form.coordinator_label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coordinator_label: e.target.value }))
                    }
                    placeholder="أو اكتب نوعاً مخصصاً"
                    className="mt-2 w-full h-11 px-4 bg-surface-container-low border border-outline-variant/15 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    الاسم الأول
                  </label>
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="w-full h-11 px-4 bg-surface-container-low border border-outline-variant/15 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-2">
                    الاسم الأخير
                  </label>
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="w-full h-11 px-4 bg-surface-container-low border border-outline-variant/15 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full h-11 px-4 bg-surface-container-low border border-outline-variant/15 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-2">
                  كلمة المرور
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="6 أحرف على الأقل"
                  className="w-full h-11 px-4 bg-surface-container-low border border-outline-variant/15 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 text-xs text-on-surface-variant flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary mt-0.5">
                  info
                </span>
                <span>
                  بعد إنشاء الحساب، عيّنه على فعالية من زر «تعيين» ليصل لصلاحيات
                  {form.role_key === "coordinator" ? " الإجلاس و" : " "}
                  مسح الحضور.
                </span>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-12 inline-flex items-center justify-center gap-2 bg-primary text-on-primary rounded-2xl font-bold text-sm hover:brightness-110 transition disabled:opacity-60"
              >
                {saving ? (
                  <span className="animate-spin w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full" />
                ) : (
                  <span className="material-symbols-outlined">check</span>
                )}
                إنشاء الحساب
              </button>
            </form>
          </div>
        </div>
      )}

      {assignTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !assigningEventId && setAssignTarget(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-surface-container rounded-t-3xl sm:rounded-3xl border border-outline-variant/15 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/10 sticky top-0 bg-surface-container">
              <div>
                <h2 className="font-bold text-on-surface">تعيين على فعاليات</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{assignTarget.name}</p>
              </div>
              <button
                type="button"
                onClick={() => !assigningEventId && setAssignTarget(null)}
                className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-widest">
                  معيّن حالياً
                </p>
                {(assignTarget.assigned_events ?? []).length === 0 ? (
                  <p className="text-sm text-on-surface-variant">لا توجد فعاليات معيّنة</p>
                ) : (
                  <ul className="space-y-2">
                    {(assignTarget.assigned_events ?? []).map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                      >
                        <span className="text-sm font-bold text-on-surface truncate">{ev.title}</span>
                        <button
                          type="button"
                          onClick={() => unassignEvent(assignTarget.id, ev.id)}
                          disabled={assigningEventId === ev.id}
                          className="shrink-0 text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          إلغاء
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-on-surface-variant mb-2 uppercase tracking-widest">
                  إضافة فعالية
                </p>
                {unassignedEventsFor(assignTarget).length === 0 ? (
                  <p className="text-sm text-on-surface-variant">جميع الفعاليات معيّنة لهذا العضو</p>
                ) : (
                  <ul className="space-y-2">
                    {unassignedEventsFor(assignTarget).map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                      >
                        <span className="text-sm font-bold text-on-surface truncate">{ev.title}</span>
                        <button
                          type="button"
                          onClick={() => assignEvent(assignTarget.id, ev.id)}
                          disabled={assigningEventId === ev.id}
                          className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-on-primary text-xs font-bold disabled:opacity-50"
                        >
                          {assigningEventId === ev.id ? (
                            <span className="animate-spin w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full" />
                          ) : (
                            <span className="material-symbols-outlined text-[14px]">add</span>
                          )}
                          تعيين
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-sm font-bold shadow-lg ${
            toast.type === "ok" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
