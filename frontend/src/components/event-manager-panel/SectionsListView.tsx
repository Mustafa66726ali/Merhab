"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { highlightMatch } from "@/components/events/HighlightText";
import { eventStatusClass } from "@/components/events/eventStatus";
import {
  platformsAPI,
  sectionsAPI,
  type MemberSectionRow,
  type MemberSectionsDashboard,
} from "@/lib/api";

function formatCreatedAt(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function sectionStatusClass(status: string) {
  switch (status) {
    case "full":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    case "pending":
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    case "partial":
      return "bg-primary-container/10 text-primary border-primary-container/25";
    case "empty":
      return "bg-surface-container-highest text-on-surface-variant border-outline-variant/25";
    default:
      return "bg-surface-container-high text-on-surface-variant border-outline-variant/20";
  }
}

function rateColor(rate: number, type: "confirm" | "attend") {
  if (rate >= 70) return type === "confirm" ? "text-primary" : "text-emerald-400";
  if (rate >= 40) return "text-amber-400";
  return "text-red-400";
}

interface SectionFormState {
  eventId: string;
  name: string;
  location: string;
  color: string;
  description: string;
}

const emptyForm: SectionFormState = {
  eventId: "",
  name: "",
  location: "",
  color: "#5b2eff",
  description: "",
};

interface SectionsListViewProps {
  eventsBasePath?: string;
}

export default function SectionsListView({
  eventsBasePath = "/event-manager/events",
}: SectionsListViewProps) {
  const [data, setData] = useState<MemberSectionsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState("");
  const [sectionStatusFilter, setSectionStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MemberSectionRow | null>(null);
  const [form, setForm] = useState<SectionFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await platformsAPI.myMemberSections();
      setData(res.data);
      setError("");
    } catch {
      setData(null);
      setError("تعذّر تحميل الأقسام.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sections = data?.sections ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sections.filter((row) => {
      if (eventFilter && String(row.event_id) !== eventFilter) return false;
      if (eventStatusFilter && row.event_status !== eventStatusFilter) return false;
      if (sectionStatusFilter && row.status !== sectionStatusFilter) return false;
      if (!q) return true;
      const haystack = [
        String(row.id),
        row.name,
        row.event_title,
        row.status_label,
        row.event_status_label,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [sections, search, eventFilter, eventStatusFilter, sectionStatusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      ...emptyForm,
      eventId: eventFilter || String(data?.events[0]?.id ?? ""),
    });
    setModalOpen(true);
  };

  const openEdit = (row: MemberSectionRow) => {
    setEditing(row);
    setForm({
      eventId: String(row.event_id),
      name: row.name,
      location: row.location || "",
      color: row.color || "#5b2eff",
      description: row.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    if (!name) {
      setError("اسم القسم مطلوب.");
      return;
    }
    if (!editing && !form.eventId) {
      setError("اختر المناسبة.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await sectionsAPI.update(editing.id, {
          name,
          location: form.location.trim(),
          color: form.color,
          description: form.description.trim(),
        });
      } else {
        await sectionsAPI.create({
          event: Number(form.eventId),
          name,
          location: form.location.trim(),
          color: form.color,
          description: form.description.trim(),
        });
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch {
      setError(editing ? "تعذّر تحديث القسم." : "تعذّر إضافة القسم.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: MemberSectionRow) => {
    if (!window.confirm(`حذف القسم «${row.name}»؟ لا يمكن التراجع.`)) return;
    setDeletingId(row.id);
    setError("");
    try {
      await sectionsAPI.delete(row.id);
      await load();
    } catch {
      setError("تعذّر حذف القسم.");
    } finally {
      setDeletingId(null);
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
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/15">
            <span className="material-symbols-outlined text-primary text-xl">grid_view</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              المجموعات والأقسام
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
              إدارة أقسام المناسبات والمجموعات التابعة — يقتصر الإضافة والتعديل على مدير الفعالية.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shrink-0 self-start"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          إضافة قسم
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative md:col-span-2 lg:col-span-2 group">
          <span className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-on-surface-variant/50 group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم القسم أو المناسبة..."
            className="w-full h-12 sm:h-14 pr-12 pl-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/50 transition-all text-sm outline-none"
          />
        </div>

        <div className="relative">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
          >
            <option value="">جميع المناسبات</option>
            {(data?.events ?? []).map((e) => (
              <option key={e.id} value={String(e.id)}>{e.title}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
            <span className="material-symbols-outlined text-sm">event</span>
          </span>
        </div>

        <div className="relative">
          <select
            value={eventStatusFilter}
            onChange={(e) => setEventStatusFilter(e.target.value)}
            className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
          >
            <option value="">حالة المناسبة</option>
            {(data?.event_status_options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
            <span className="material-symbols-outlined text-sm">tune</span>
          </span>
        </div>

        <div className="relative lg:col-span-1">
          <select
            value={sectionStatusFilter}
            onChange={(e) => setSectionStatusFilter(e.target.value)}
            className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
          >
            <option value="">حالة القسم</option>
            {(data?.section_status_options ?? []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
            <span className="material-symbols-outlined text-sm">filter_alt</span>
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-outline-variant/10 bg-surface-container-high/40">
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">اسم القسم</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">المناسبة</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">المجموعات</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">تاريخ الإضافة</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">المدعوين</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">التأكيد</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">الحضور</th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">حالة القسم</th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-on-surface-variant">
                    لا توجد أقسام مطابقة
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-surface-container-high/30 transition-colors"
                  >
                    <td className="px-4 py-3 tabular-nums text-on-surface-variant font-medium">
                      {highlightMatch(String(row.id), search)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.color || "#5b2eff" }}
                        />
                        <span className="font-bold text-on-surface truncate">
                          {highlightMatch(row.name, search)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex flex-col gap-1">
                        <span className="text-on-surface font-medium line-clamp-1">
                          {highlightMatch(row.event_title, search)}
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${eventStatusClass(row.event_status)}`}
                        >
                          {row.event_status_label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold text-on-surface">
                      {row.groups_count}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant whitespace-nowrap">
                      {formatCreatedAt(row.created_at)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold text-on-surface">
                      {row.guests_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold">
                      <span className={rateColor(row.confirmation_rate, "confirm")}>
                        {row.confirmation_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-bold">
                      <span className={rateColor(row.attendance_rate, "attend")}>
                        {row.attendance_rate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border whitespace-nowrap ${sectionStatusClass(row.status)}`}
                      >
                        {row.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`${eventsBasePath}/${row.event_id}/groups`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-colors"
                          title="عرض"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-colors"
                          title="تعديل"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          disabled={deletingId === row.id}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="حذف"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-outline-variant/10 text-xs text-on-surface-variant">
          {filtered.length} من {sections.length} قسم
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h2 className="font-bold text-on-surface text-lg">
                {editing ? "تعديل القسم" : "إضافة قسم"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!editing && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                    المناسبة
                  </label>
                  <select
                    value={form.eventId}
                    onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
                    className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="">اختر المناسبة</option>
                    {(data?.events ?? []).map((e) => (
                      <option key={e.id} value={String(e.id)}>{e.title}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  اسم القسم
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="مثال: كبار الشخصيات"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  موقع القسم
                </label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="الطابق الأرضي - القاعة 4"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  لون القسم
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                    className="h-10 w-14 rounded-lg border border-outline-variant/20 bg-transparent cursor-pointer"
                  />
                  <span className="text-sm text-on-surface-variant tabular-nums">{form.color}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  وصف (اختياري)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold text-sm hover:bg-surface-container-high transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
              >
                {saving ? "جاري الحفظ..." : editing ? "حفظ التعديل" : "إضافة القسم"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
