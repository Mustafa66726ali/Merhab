"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { highlightMatch } from "@/components/events/HighlightText";
import {
  GUEST_STATUS_OPTIONS,
  guestStatusClass,
  guestStatusDotClass,
} from "@/components/events/guestStatus";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import AddGuestModal, { type AddGuestFormState } from "@/components/platform-panel/AddGuestModal";
import BulkDeleteGuestsModal from "@/components/platform-panel/BulkDeleteGuestsModal";
import { useEvent } from "@/hooks/useEvent";
import {
  eventsAPI,
  extractApiList,
  guestsAPI,
  type EventGuestRow,
  type EventListItem,
  type GuestDirectoryEntry,
} from "@/lib/api";
import {
  downloadGuestImportTemplate,
  exportGuestsExcel,
  parseGuestExcelFile,
} from "@/lib/guestExcel";
import { useAuthStore } from "@/lib/store";

function guestInitial(name: string) {
  const t = name.trim();
  return t ? t[0] : "?";
}

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const res = (e as {
      response?: { data?: { detail?: string; errors?: string[]; email?: string[] } };
    }).response;
    const data = res?.data;
    if (data) {
      if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
      if (Array.isArray(data.errors) && data.errors[0]) return data.errors[0];
      const email = data.email;
      if (Array.isArray(email) && email[0]) return email[0];
    }
  }
  return fallback;
}

interface PlatformGuestsListViewProps {
  /** عند التمرير: ضيوف فعالية واحدة فقط */
  eventId?: number;
  eventsBasePath?: string;
  guestsBasePath?: string;
}

export default function PlatformGuestsListView({
  eventId,
  eventsBasePath = "/platform/events",
  guestsBasePath,
}: PlatformGuestsListViewProps) {
  const resolvedGuestsBasePath =
    guestsBasePath ?? eventsBasePath.replace(/\/events\/?$/, "/guests");
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManageGuests =
    user?.role === "event_manager" ||
    user?.role === "platform_admin" ||
    user?.role === "event_organizer";
  const isEventScope = eventId != null;
  const eventQuery = useEvent(isEventScope ? eventId! : 0);
  const event = eventQuery.data ?? null;

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [actionError, setActionError] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventGuestRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [guestForm, setGuestForm] = useState<AddGuestFormState>({
    mode: "new",
    existingGuestId: "",
    full_name: "",
    email: "",
    phone: "",
    eventId: "",
    sectionId: "",
    groupId: "",
  });
  const [directoryGuests, setDirectoryGuests] = useState<GuestDirectoryEntry[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const directorySearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const guestsQuery = useQuery({
    queryKey: [
      "guests",
      isEventScope ? { event: eventId } : "all",
      eventFilter,
      sectionFilter,
      statusFilter,
      search.trim(),
    ],
    queryFn: async () => {
      const params: Record<string, unknown> = { page_size: 1000 };
      if (isEventScope) params.event = eventId;
      else if (eventFilter) params.event = eventFilter;
      if (sectionFilter) params.section = sectionFilter;
      if (statusFilter) params.status = statusFilter;
      const q = search.trim();
      if (q) params.search = q;
      const res = await guestsAPI.list(params);
      return extractApiList<EventGuestRow>(res.data);
    },
    staleTime: 2 * 60 * 1000,
  });

  const statsParams = useMemo(() => {
    const params: Record<string, unknown> = {};
    if (isEventScope) params.event = eventId;
    else if (eventFilter) params.event = eventFilter;
    if (sectionFilter) params.section = sectionFilter;
    if (statusFilter) params.status = statusFilter;
    const q = search.trim();
    if (q) params.search = q;
    return params;
  }, [isEventScope, eventId, eventFilter, sectionFilter, statusFilter, search]);

  const statsQuery = useQuery({
    queryKey: ["guests", "stats", statsParams],
    queryFn: async () => {
      const res = await guestsAPI.stats(statsParams);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const eventsListQuery = useQuery({
    queryKey: ["events", "list", "guests-filter"],
    queryFn: async () => {
      const res = await eventsAPI.list({ page_size: 500 });
      return extractApiList<EventListItem>(res.data);
    },
    enabled: !isEventScope,
    staleTime: 5 * 60 * 1000,
  });

  const guests = guestsQuery.data ?? [];
  const platformEvents = eventsListQuery.data ?? [];
  const stats = statsQuery.data ?? {
    total: 0,
    pending: 0,
    invited: 0,
    confirmed: 0,
    attended: 0,
    declined: 0,
    confirmation_rate: 0,
    attendance_rate: 0,
  };
  const loading =
    guestsQuery.isLoading ||
    statsQuery.isLoading ||
    (isEventScope && eventQuery.isLoading);
  const error =
    guestsQuery.isError
      ? isEventScope
        ? "تعذّر تحميل ضيوف المناسبة."
        : "تعذّر تحميل قائمة الضيوف."
      : "";

  const effectiveEventId = isEventScope
    ? eventId!
    : eventFilter
      ? Number(eventFilter)
      : null;

  const filterEventQuery = useEvent(effectiveEventId && !isEventScope ? effectiveEventId : 0);
  const eventForSections = isEventScope ? event : filterEventQuery.data;

  useEffect(() => {
    if (!isEventScope) {
      setSectionFilter("");
    }
  }, [eventFilter, isEventScope]);

  const sectionOptions = useMemo(() => {
    if (!effectiveEventId) return [];
    const map = new Map<number, string>();
    eventForSections?.sections?.forEach((s) => map.set(s.id, s.name));
    guests
      .filter((g) => g.event === effectiveEventId)
      .forEach((g) => {
        if (g.section && g.section_name) map.set(g.section, g.section_name);
      });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ar"))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [effectiveEventId, eventForSections, guests]);

  const modalEventId =
    addModalOpen && !isEventScope && guestForm.eventId
      ? Number(guestForm.eventId)
      : effectiveEventId;
  const modalEventQuery = useEvent(modalEventId && addModalOpen ? modalEventId : 0);
  const modalEventForSections = isEventScope ? event : modalEventQuery.data;

  const modalSectionOptions = useMemo(() => {
    if (!modalEventId) return [];
    const map = new Map<number, string>();
    modalEventForSections?.sections?.forEach((s) => map.set(s.id, s.name));
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ar"))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [modalEventId, modalEventForSections]);

  const modalGroupOptions = useMemo(() => {
    if (!modalEventId || !guestForm.sectionId) return [];
    const section = modalEventForSections?.sections?.find(
      (s) => String(s.id) === guestForm.sectionId
    );
    return (section?.groups ?? []).map((g) => ({
      value: String(g.id),
      label: g.name,
    }));
  }, [modalEventId, guestForm.sectionId, modalEventForSections]);

  const eventOptions = useMemo(() => {
    if (isEventScope) return [];
    const map = new Map<number, string>();
    platformEvents.forEach((e) => map.set(e.id, e.title));
    guests.forEach((g) => {
      if (g.event && g.event_title) map.set(g.event, g.event_title);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ar"))
      .map(([id, title]) => ({ id, title }));
  }, [platformEvents, guests, isEventScope]);

  const filtered = guests;

  const refreshGuests = () => {
    queryClient.invalidateQueries({ queryKey: ["guests"] });
  };

  const openAddGuest = () => {
    setGuestForm({
      mode: "new",
      existingGuestId: "",
      full_name: "",
      email: "",
      phone: "",
      eventId: effectiveEventId ? String(effectiveEventId) : eventFilter,
      sectionId: sectionFilter,
      groupId: "",
    });
    setActionError("");
    setAddModalOpen(true);
    void loadGuestDirectory("");
  };

  const loadGuestDirectory = async (search: string) => {
    const excludeEvent = isEventScope
      ? eventId
      : Number(guestForm.eventId || eventFilter) || undefined;
    setDirectoryLoading(true);
    try {
      const res = await guestsAPI.directory({
        search: search || undefined,
        exclude_event: excludeEvent,
      });
      setDirectoryGuests(res.data);
    } catch {
      setDirectoryGuests([]);
    } finally {
      setDirectoryLoading(false);
    }
  };

  const handleDirectorySearch = (query: string) => {
    if (directorySearchRef.current) clearTimeout(directorySearchRef.current);
    directorySearchRef.current = setTimeout(() => {
      void loadGuestDirectory(query);
    }, 300);
  };

  const handleAddGuest = async () => {
    const full_name = guestForm.full_name.trim();
    const targetEvent = isEventScope
      ? eventId!
      : Number(guestForm.eventId || eventFilter);
    if (guestForm.mode === "new" && !full_name) {
      setActionError("اسم الضيف مطلوب.");
      return;
    }
    if (guestForm.mode === "existing" && !guestForm.existingGuestId) {
      setActionError("اختر ضيفاً من القائمة.");
      return;
    }
    if (!targetEvent) {
      setActionError("اختر المناسبة أولاً.");
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await guestsAPI.create({
        event: targetEvent,
        full_name,
        email: guestForm.email.trim(),
        phone: guestForm.phone.trim(),
        section: guestForm.sectionId ? Number(guestForm.sectionId) : null,
        group: guestForm.groupId ? Number(guestForm.groupId) : null,
        status: "pending",
      });
      setAddModalOpen(false);
      refreshGuests();
    } catch (e) {
      setActionError(errMessage(e, "تعذّر إضافة الضيف."));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGuest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError("");
    try {
      await guestsAPI.delete(deleteTarget.id);
      setDeleteTarget(null);
      refreshGuests();
    } catch {
      setActionError("تعذّر حذف الضيف.");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setActionError("");
    try {
      const res = await guestsAPI.bulkDelete(ids);
      const skipped = res.data.skipped?.length ?? 0;
      setBulkDeleteOpen(false);
      refreshGuests();
      if (skipped > 0) {
        setActionError(
          res.data.detail ||
            `تم حذف ${res.data.deleted_count} — تُخطّي ${skipped} خارج الصلاحية`
        );
      }
    } catch (e) {
      setActionError(errMessage(e, "تعذّر الحذف الجماعي للضيوف."));
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = () => {
    exportGuestsExcel(
      filtered,
      `guests-${effectiveEventId ?? "all"}-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const resetImportModal = () => {
    setImportFile(null);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const handleImportFile = async () => {
    const file = importFile;
    const targetEvent = effectiveEventId;
    if (!file) {
      setActionError("اختر ملف Excel أولاً.");
      return;
    }
    if (!targetEvent) {
      setActionError("اختر المناسبة من الفلاتر قبل الاستيراد.");
      return;
    }
    setImporting(true);
    setActionError("");
    try {
      const rows = await parseGuestExcelFile(file);
      if (rows.length === 0) {
        setActionError("لم يُعثر على ضيوف في الملف. تأكد من الأعمدة: الاسم، البريد، الجوال.");
        return;
      }
      const res = await guestsAPI.importGuests(
        rows.map((r) => ({
          event: targetEvent,
          full_name: r.full_name,
          email: r.email,
          phone: r.phone,
          status: "pending",
        }))
      );
      const data = res.data as
        | EventGuestRow[]
        | { created?: EventGuestRow[]; partial?: boolean; detail?: string; errors?: string[] };
      if (Array.isArray(data)) {
        setImportModalOpen(false);
        resetImportModal();
        refreshGuests();
        return;
      }
      if (data.created?.length) {
        setImportModalOpen(false);
        resetImportModal();
        refreshGuests();
        if (data.partial && data.errors?.length) {
          setActionError(data.detail || data.errors[0]);
        }
        return;
      }
      setActionError(
        (typeof data === "object" && data && "detail" in data && data.detail) ||
          "تعذّر استيراد الضيوف."
      );
    } catch (e) {
      setActionError(errMessage(e, "تعذّر استيراد الضيوف."));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center text-on-surface-variant">
        {error}
      </div>
    );
  }

  const colSpan = (isEventScope ? 5 : 6) + (canManageGuests ? 1 : 0);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-3">
          {isEventScope ? (
            <EventPageHeader
              eventId={eventId!}
              eventTitle={event?.title}
              currentLabel="إدارة الضيوف"
              eventsBasePath={eventsBasePath}
            />
          ) : (
            <nav className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span className="text-on-surface font-medium">ضيوف كافة المناسبات</span>
            </nav>
          )}
          <h1 className="text-2xl sm:text-4xl font-black text-on-surface tracking-tight font-headline">
            {isEventScope ? "إدارة الضيوف" : "ضيوف كافة المناسبات"}
          </h1>
          <p className="text-on-surface-variant max-w-xl text-sm sm:text-base leading-relaxed">
            {isEventScope
              ? `تنظيم ومتابعة قائمة الحضور لفعالية «${event?.title}». تتبع حالة التأكيد وتوزيع الضيوف على الأقسام والمجموعات.`
              : "قائمة شاملة لجميع ضيوف مناسبات منصتك. ابحث وفلتر حسب الفعالية، القسم، والحالة."}
          </p>
        </div>
        {canManageGuests && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openAddGuest}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-110 transition-all"
              title="إضافة ضيف"
            >
              <span className="material-symbols-outlined text-lg">person_add</span>
              <span className="hidden sm:inline">إضافة ضيف</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError("");
                setBulkDeleteOpen(true);
              }}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 font-bold text-sm hover:bg-rose-500/20 transition-all disabled:opacity-40"
              title="حذف جماعي"
            >
              <span className="material-symbols-outlined text-lg">group_remove</span>
              <span className="hidden sm:inline">حذف جماعي</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActionError("");
                resetImportModal();
                setImportModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/25 bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-all"
              title="استيراد"
            >
              <span className="material-symbols-outlined text-lg">upload</span>
              <span className="hidden sm:inline">استيراد</span>
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/25 bg-surface-container-low text-on-surface font-bold text-sm hover:bg-surface-container-high transition-all disabled:opacity-50"
              title="تصدير"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              <span className="hidden sm:inline">تصدير</span>
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {actionError}
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-3 sm:gap-4 ${
          isEventScope ? "md:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-5"
        }`}
      >
        <div
          className={`relative group ${isEventScope ? "md:col-span-2" : "lg:col-span-2"}`}
        >
          <span className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-on-surface-variant/50 group-focus-within:text-primary transition-colors">
            <span className="material-symbols-outlined">search</span>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="البحث بالاسم، البريد، الجوال، الفعالية..."
            className="w-full h-12 sm:h-14 pr-12 pl-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface placeholder:text-on-surface-variant/40 focus:ring-2 focus:ring-primary/50 transition-all text-sm outline-none"
          />
        </div>

        {!isEventScope && (
          <div className="relative">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
            >
              <option value="">جميع المناسبات</option>
              {eventOptions.map((e) => (
                <option key={e.id} value={String(e.id)}>{e.title}</option>
              ))}
            </select>
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
              <span className="material-symbols-outlined text-sm">event</span>
            </span>
          </div>
        )}

        <div className="relative">
          {effectiveEventId ? (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
            >
              <option value="">جميع الأقسام</option>
              {sectionOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          ) : (
            <select
              disabled
              value=""
              className="w-full h-12 sm:h-14 px-4 bg-surface-container-low/60 border border-outline-variant/10 rounded-2xl text-on-surface-variant text-sm appearance-none outline-none cursor-not-allowed opacity-70"
            >
              <option value="">الرجاء اختيار مناسبة لاختيار القسم</option>
            </select>
          )}
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
            <span className="material-symbols-outlined text-sm">filter_alt</span>
          </span>
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full h-12 sm:h-14 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm focus:ring-2 focus:ring-primary/50 appearance-none outline-none"
          >
            {GUEST_STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-on-surface-variant/50">
            <span className="material-symbols-outlined text-sm">analytics</span>
          </span>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl sm:rounded-3xl overflow-hidden border border-outline-variant/10 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-surface-container-highest/20">
                <th className="px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                  الاسم
                </th>
                {!isEventScope && (
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                    الفعالية
                  </th>
                )}
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                  رقم الجوال
                </th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                  القسم
                </th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                  المجموعة
                </th>
                <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10">
                  الحالة
                </th>
                {canManageGuests && (
                  <th className="px-4 sm:px-6 py-4 sm:py-5 text-[10px] sm:text-xs font-bold text-on-surface-variant/70 uppercase tracking-widest border-b border-outline-variant/10 text-center">
                    إجراءات
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center text-on-surface-variant text-sm">
                    لا توجد نتائج مطابقة
                  </td>
                </tr>
              ) : (
                filtered.map((guest) => (
                  <tr key={guest.id} className="hover:bg-surface-container-high/30 transition-colors">
                    <td className="px-4 sm:px-8 py-4 sm:py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                          {guestInitial(guest.full_name)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`${resolvedGuestsBasePath}/${guest.id}`}
                            className="text-sm font-bold text-on-surface truncate hover:text-primary transition-colors block"
                          >
                            {highlightMatch(guest.full_name, search)}
                          </Link>
                          {guest.email && (
                            <div className="text-xs text-on-surface-variant truncate">
                              {highlightMatch(guest.email, search)}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {!isEventScope && (
                      <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm max-w-[160px]">
                        <Link
                          href={`${eventsBasePath}/${guest.event}`}
                          className="font-bold text-primary hover:underline line-clamp-2"
                          title={guest.event_title}
                        >
                          {highlightMatch(guest.event_title || "—", search)}
                        </Link>
                      </td>
                    )}
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm font-medium text-on-surface-variant whitespace-nowrap">
                      {guest.phone ? highlightMatch(guest.phone, search) : "—"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                      {guest.section_name ? (
                        <span className="px-3 py-1 rounded-lg bg-tertiary-container/10 text-tertiary text-xs font-bold">
                          {highlightMatch(guest.section_name, search)}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5 text-sm text-on-surface-variant">
                      {guest.group_name ? highlightMatch(guest.group_name, search) : "—"}
                    </td>
                    <td className="px-4 sm:px-6 py-4 sm:py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${guestStatusClass(guest.status)}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${guestStatusDotClass(guest.status)}`}
                        />
                        {highlightMatch(guest.status_label, search)}
                      </span>
                    </td>
                    {canManageGuests && (
                      <td className="px-4 sm:px-6 py-4 sm:py-5">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            href={`${resolvedGuestsBasePath}/${guest.id}`}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-primary hover:bg-surface-container-highest transition-all"
                            title="عرض"
                          >
                            <span className="material-symbols-outlined text-lg">visibility</span>
                          </Link>
                          <Link
                            href={`${resolvedGuestsBasePath}/${guest.id}/edit`}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-tertiary hover:bg-surface-container-highest transition-all"
                            title="تعديل"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(guest)}
                            className="w-9 h-9 rounded-lg flex items-center justify-center bg-surface-container-lowest text-on-surface-variant hover:text-error hover:bg-surface-container-highest transition-all"
                            title="حذف"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 sm:px-8 py-4 bg-surface-container-lowest/50 border-t border-outline-variant/10 flex items-center justify-between gap-4">
          <span className="text-xs text-on-surface-variant/70 font-medium">
            عرض {filtered.length} من أصل {stats.total} ضيف
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5 relative overflow-hidden">
          <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-widest mb-4">
            إجمالي المسجلين
          </p>
          <h3 className="text-4xl font-black text-on-surface tracking-tighter tabular-nums">
            {stats.total}
          </h3>
        </div>
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5">
          <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-widest mb-4">
            تم التأكيد
          </p>
          <div className="flex items-end gap-3">
            <h3 className="text-4xl font-black text-on-surface tracking-tighter tabular-nums">
              {stats.confirmed}
            </h3>
            <span className="text-on-surface-variant/50 text-xs mb-1">
              {stats.confirmation_rate}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, stats.confirmation_rate)}%` }}
            />
          </div>
        </div>
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5">
          <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-widest mb-4">
            حضور فعلي
          </p>
          <h3 className="text-4xl font-black text-emerald-400 tracking-tighter tabular-nums">
            {stats.attended}
          </h3>
          {stats.total > 0 && (
            <p className="text-xs text-on-surface-variant/60 mt-2">
              {stats.attendance_rate}% من الإجمالي
            </p>
          )}
        </div>
        <div className="bg-surface-container-low p-6 rounded-3xl border border-outline-variant/5">
          <p className="text-on-surface-variant/60 text-xs font-bold uppercase tracking-widest mb-4">
            اعتذار
          </p>
          <h3 className="text-4xl font-black text-error tracking-tighter tabular-nums">
            {stats.declined}
          </h3>
        </div>
      </div>

      {addModalOpen && (
        <AddGuestModal
          open={addModalOpen}
          saving={saving}
          isEventScope={isEventScope}
          eventTitle={event?.title}
          eventOptions={eventOptions}
          form={guestForm}
          onFormChange={(patch) => setGuestForm((f) => ({ ...f, ...patch }))}
          sectionOptions={modalSectionOptions}
          groupOptions={modalGroupOptions}
          eventForSections={modalEventForSections}
          directoryGuests={directoryGuests}
          directoryLoading={directoryLoading}
          onDirectorySearch={handleDirectorySearch}
          onClose={() => !saving && setAddModalOpen(false)}
          onSubmit={handleAddGuest}
        />
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-on-surface">حذف الضيف</h2>
            <p className="text-sm text-on-surface-variant">
              هل أنت متأكد من حذف «{deleteTarget.full_name}»؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-outline-variant/25 text-on-surface text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteGuest}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {deleting ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkDeleteGuestsModal
        open={bulkDeleteOpen}
        guests={filtered}
        showEventColumn={!isEventScope}
        deleting={bulkDeleting}
        onClose={() => !bulkDeleting && setBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
      />

      {importModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => {
            if (!importing) {
              setImportModalOpen(false);
              resetImportModal();
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h2 className="font-bold text-on-surface text-lg">استيراد ضيوف</h2>
              <button
                type="button"
                onClick={() => {
                  if (!importing) {
                    setImportModalOpen(false);
                    resetImportModal();
                  }
                }}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {!effectiveEventId && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  اختر المناسبة من الفلاتر أعلاه قبل الاستيراد.
                </p>
              )}
              <p className="text-sm text-on-surface-variant">
                ملف Excel بأعمدة: الاسم، البريد، الجوال (الصف الأول ترويسة).
              </p>
              <button
                type="button"
                onClick={downloadGuestImportTemplate}
                className="text-xs font-bold text-primary underline underline-offset-2"
              >
                تنزيل نموذج Excel
              </button>
              <input
                ref={importFileRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                disabled={!effectiveEventId || importing}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImportFile(file);
                  setActionError("");
                }}
                className="w-full text-sm text-on-surface-variant file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-primary-container file:text-on-primary-container file:font-bold"
              />
              {importFile && (
                <p className="text-xs text-on-surface-variant bg-surface-container-high rounded-xl px-3 py-2">
                  الملف المختار: <span className="font-bold text-on-surface">{importFile.name}</span>
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-outline-variant/10 flex items-center justify-between gap-3">
              <p className="text-xs text-on-surface-variant">
                {importing ? "جاري الاستيراد..." : "سيتم إضافة الضيوف للمناسبة المختارة."}
              </p>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => {
                    setImportModalOpen(false);
                    resetImportModal();
                  }}
                  className="px-4 py-2 rounded-xl border border-outline-variant/25 text-on-surface text-sm font-bold disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!effectiveEventId || !importFile || importing}
                  onClick={() => void handleImportFile()}
                  className="px-4 py-2 rounded-xl bg-primary-container text-on-primary-container text-sm font-bold disabled:opacity-50"
                >
                  {importing ? "جاري الإضافة..." : "إضافة"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
