"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { highlightMatch } from "@/components/events/HighlightText";
import { eventStatusClass } from "@/components/events/eventStatus";
import {
  eventsAPI,
  guestsAPI,
  platformsAPI,
  sectionsAPI,
  type EventDetail,
  type EventGuestRow,
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

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results?: unknown[] }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  return [];
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
  const [distributionModalOpen, setDistributionModalOpen] = useState(false);
  const [distributionEventId, setDistributionEventId] = useState("");
  const [distributionEvent, setDistributionEvent] = useState<EventDetail | null>(null);
  const [distributionGuests, setDistributionGuests] = useState<EventGuestRow[]>([]);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [distributionSaving, setDistributionSaving] = useState(false);
  const [distributionSearch, setDistributionSearch] = useState("");
  const [distributionAssignments, setDistributionAssignments] = useState<
    Record<number, { sectionId: string; groupId: string }>
  >({});

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

  const loadDistributionData = useCallback(async (eventId: number) => {
    setDistributionLoading(true);
    try {
      const [eventRes, guestsRes] = await Promise.all([
        eventsAPI.get(eventId),
        guestsAPI.list({ event: eventId, page_size: 1000 }),
      ]);
      const guests = extractList<EventGuestRow>(guestsRes.data);
      setDistributionEvent(eventRes.data);
      setDistributionGuests(guests);
      const initialAssignments: Record<number, { sectionId: string; groupId: string }> = {};
      guests.forEach((guest) => {
        initialAssignments[guest.id] = {
          sectionId: guest.section ? String(guest.section) : "",
          groupId: guest.group ? String(guest.group) : "",
        };
      });
      setDistributionAssignments(initialAssignments);
      setError("");
    } catch {
      setDistributionEvent(null);
      setDistributionGuests([]);
      setDistributionAssignments({});
      setError("تعذّر تحميل الضيوف للتوزيع.");
    } finally {
      setDistributionLoading(false);
    }
  }, []);

  const openDistributionModal = () => {
    const preferredEventId = eventFilter || String(data?.events[0]?.id ?? "");
    setDistributionEventId(preferredEventId);
    setDistributionSearch("");
    setDistributionEvent(null);
    setDistributionGuests([]);
    setDistributionAssignments({});
    setDistributionModalOpen(true);
    if (preferredEventId) {
      void loadDistributionData(Number(preferredEventId));
    }
  };

  const closeDistributionModal = () => {
    if (distributionLoading || distributionSaving) return;
    setDistributionModalOpen(false);
  };

  const handleDistributionEventChange = (nextEventId: string) => {
    setDistributionEventId(nextEventId);
    setDistributionSearch("");
    if (!nextEventId) {
      setDistributionEvent(null);
      setDistributionGuests([]);
      setDistributionAssignments({});
      return;
    }
    void loadDistributionData(Number(nextEventId));
  };

  const updateGuestSection = (guestId: number, sectionId: string) => {
    setDistributionAssignments((prev) => ({
      ...prev,
      [guestId]: { sectionId, groupId: "" },
    }));
  };

  const updateGuestGroup = (guestId: number, groupId: string) => {
    setDistributionAssignments((prev) => {
      const current = prev[guestId] ?? { sectionId: "", groupId: "" };
      return {
        ...prev,
        [guestId]: { ...current, groupId },
      };
    });
  };

  const filteredDistributionGuests = useMemo(() => {
    const q = distributionSearch.trim().toLowerCase();
    if (!q) return distributionGuests;
    return distributionGuests.filter((guest) =>
      [
        guest.full_name,
        guest.event_title,
        guest.section_name || "",
        guest.group_name || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [distributionGuests, distributionSearch]);

  const handleSaveDistribution = async () => {
    if (!distributionEventId || !distributionEvent) {
      setError("اختر المناسبة أولاً.");
      return;
    }
    const changedGuests = distributionGuests.filter((guest) => {
      const next = distributionAssignments[guest.id] ?? { sectionId: "", groupId: "" };
      const currentSection = guest.section ? String(guest.section) : "";
      const currentGroup = guest.group ? String(guest.group) : "";
      return next.sectionId !== currentSection || next.groupId !== currentGroup;
    });
    if (changedGuests.length === 0) {
      setError("لا توجد تغييرات جديدة للحفظ.");
      return;
    }

    setDistributionSaving(true);
    setError("");
    try {
      await Promise.all(
        changedGuests.map((guest) => {
          const next = distributionAssignments[guest.id] ?? { sectionId: "", groupId: "" };
          return guestsAPI.patch(guest.id, {
            section: next.sectionId ? Number(next.sectionId) : null,
            group: next.groupId ? Number(next.groupId) : null,
          });
        })
      );
      await Promise.all([load(), loadDistributionData(Number(distributionEventId))]);
    } catch {
      setError("تعذّر حفظ توزيع الضيوف.");
    } finally {
      setDistributionSaving(false);
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
        <button
          type="button"
          onClick={openDistributionModal}
          className="inline-flex items-center justify-center gap-2 border border-outline-variant/20 bg-surface-container-low text-on-surface px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-surface-container-high transition-all shrink-0 self-start"
        >
          <span className="material-symbols-outlined text-lg">group_work</span>
          توزيع الضيوف
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

      {distributionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm"
          onClick={closeDistributionModal}
        >
          <div
            className="w-full max-w-6xl max-h-[92vh] rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/10 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-on-surface text-lg sm:text-xl">توزيع الضيوف على الأقسام والمجموعات</h2>
                <p className="text-xs sm:text-sm text-on-surface-variant mt-1">
                  اختر القسم ثم المجموعة لكل ضيف، ثم احفظ لتحديث البيانات مباشرة.
                </p>
              </div>
              <button
                type="button"
                onClick={closeDistributionModal}
                disabled={distributionLoading || distributionSaving}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="px-4 sm:px-6 py-4 border-b border-outline-variant/10 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">المناسبة</label>
                <select
                  value={distributionEventId}
                  onChange={(e) => handleDistributionEventChange(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">اختر المناسبة</option>
                  {(data?.events ?? []).map((event) => (
                    <option key={event.id} value={String(event.id)}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">بحث الضيوف</label>
                <input
                  type="search"
                  value={distributionSearch}
                  onChange={(e) => setDistributionSearch(e.target.value)}
                  placeholder="بحث بالاسم أو القسم أو المجموعة..."
                  disabled={!distributionEventId}
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {!distributionEventId ? (
                <div className="p-10 text-center text-on-surface-variant">اختر المناسبة لعرض الضيوف.</div>
              ) : distributionLoading ? (
                <div className="p-10 flex justify-center">
                  <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
                </div>
              ) : filteredDistributionGuests.length === 0 ? (
                <div className="p-10 text-center text-on-surface-variant">لا يوجد ضيوف لعرضهم.</div>
              ) : (
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="sticky top-0 bg-surface-container-high/95 backdrop-blur border-b border-outline-variant/10 z-10">
                    <tr>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">الاسم</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">المناسبة</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">القسم</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">المجموعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredDistributionGuests.map((guest) => {
                      const assignment = distributionAssignments[guest.id] ?? {
                        sectionId: guest.section ? String(guest.section) : "",
                        groupId: guest.group ? String(guest.group) : "",
                      };
                      const rowSection = distributionEvent?.sections?.find(
                        (section) => String(section.id) === assignment.sectionId
                      );
                      const rowGroups = rowSection?.groups ?? [];
                      return (
                        <tr key={guest.id} className="hover:bg-surface-container-high/25">
                          <td className="px-4 py-3 font-medium text-on-surface">{guest.full_name}</td>
                          <td className="px-4 py-3 text-on-surface-variant">{guest.event_title}</td>
                          <td className="px-4 py-3">
                            <select
                              value={assignment.sectionId}
                              onChange={(e) => updateGuestSection(guest.id, e.target.value)}
                              className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/10 rounded-lg text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
                            >
                              <option value="">بدون قسم</option>
                              {(distributionEvent?.sections ?? []).map((section) => (
                                <option key={section.id} value={String(section.id)}>
                                  {section.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={assignment.groupId}
                              onChange={(e) => updateGuestGroup(guest.id, e.target.value)}
                              disabled={!assignment.sectionId}
                              className="w-full px-3 py-2 bg-surface-container-high border border-outline-variant/10 rounded-lg text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                            >
                              <option value="">
                                {assignment.sectionId ? "بدون مجموعة" : "اختر قسماً أولاً"}
                              </option>
                              {rowGroups.map((group) => (
                                <option key={group.id} value={String(group.id)}>
                                  {group.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-4 sm:px-6 py-4 border-t border-outline-variant/10 flex items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">
                {distributionSaving
                  ? "جاري حفظ التوزيع..."
                  : `${filteredDistributionGuests.length} صف ظاهر للتوزيع`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDistributionModal}
                  disabled={distributionLoading || distributionSaving}
                  className="px-4 py-2 rounded-xl border border-outline-variant/20 text-on-surface-variant text-sm font-bold disabled:opacity-50"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleSaveDistribution}
                  disabled={!distributionEventId || distributionLoading || distributionSaving}
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold disabled:opacity-50"
                >
                  {distributionSaving ? "جاري الحفظ..." : "حفظ التوزيع"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
