"use client";

/**
 * صفحة الجدول الزمني للفعالية — عرض وتعديل الأنشطة.
 * مستخدمة من لوحة مدير الفعالية ولوحة المنصة.
 */
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import EventScheduleStats from "@/components/platform-panel/schedule/EventScheduleStats";
import ScheduleActivityForm, {
  emptyScheduleForm,
  formToPayload,
  scheduleToForm,
  type ScheduleFormState,
} from "@/components/platform-panel/schedule/ScheduleActivityForm";
import ScheduleTimelineItem from "@/components/platform-panel/schedule/ScheduleTimelineItem";
import {
  computeScheduleCoverage,
  isGeneralLocation,
  locationLabel,
} from "@/components/platform-panel/schedule/scheduleUtils";
import { exportScheduleToPdf } from "@/lib/exportEventPdf";
import { useEvent } from "@/hooks/useEvent";
import { schedulesAPI, type EventScheduleItem } from "@/lib/api";

export interface EventScheduleViewProps {
  eventId: number;
  eventsBasePath?: string;
  /** مدير الفعالية يمكنه الإضافة والتعديل */
  canManage?: boolean;
}

export default function EventScheduleView({
  eventId,
  eventsBasePath = "/event-manager/events",
  canManage = false,
}: EventScheduleViewProps) {
  const queryClient = useQueryClient();
  const { data: event, isLoading, isError } = useEvent(eventId);
  const schedules = event?.schedules ?? [];

  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<ScheduleFormState>(emptyScheduleForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<ScheduleFormState>(emptyScheduleForm());

  const locationTabs = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => {
      const loc = (s.location || "").trim();
      if (loc) set.add(loc);
    });
    event?.sections?.forEach((sec) => {
      const loc = (sec.location || "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [schedules, event?.sections]);

  const filteredSchedules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schedules
      .filter((s) => {
        if (!locationFilter) return true;
        if (isGeneralLocation(s.location)) return true;
        return (s.location || "").trim() === locationFilter;
      })
      .filter((s) => {
        if (!q) return true;
        const hay = [s.title, s.description, s.location, locationLabel(s.location)]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [schedules, search, locationFilter]);

  const coverage = event
    ? computeScheduleCoverage(
        event.date,
        event.time,
        event.end_date,
        event.end_time,
        schedules
      )
    : {
        plannedMinutes: 0,
        windowMinutes: 0,
        percent: 0,
        windowSource: "none" as const,
        windowLabel: "",
      };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["event", eventId] });

  const validateForm = (form: ScheduleFormState) => {
    if (!form.title.trim()) return "اسم النشاط مطلوب.";
    if (!form.startTime || !form.endTime) return "وقت البداية والانتهاء مطلوبان.";
    if (form.endTime <= form.startTime) return "وقت الانتهاء يجب أن يكون بعد وقت البداية.";
    if (form.locationMode === "custom" && !form.customLocation.trim()) {
      return "أدخل الموقع المخصص أو اختر «عام».";
    }
    return "";
  };

  const handleAdd = async () => {
    if (!event) return;
    const err = validateForm(addForm);
    if (err) {
      setActionError(err);
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await schedulesAPI.create({ event: eventId, ...formToPayload(addForm, event.date) });
      setAdding(false);
      setAddForm(emptyScheduleForm());
      invalidate();
    } catch {
      setActionError("تعذّر إضافة النشاط.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: EventScheduleItem) => {
    setEditingId(item.id);
    setEditForm(scheduleToForm(item));
    setAdding(false);
    setActionError("");
  };

  const handleUpdate = async () => {
    if (!event || !editingId) return;
    const err = validateForm(editForm);
    if (err) {
      setActionError(err);
      return;
    }
    setSaving(true);
    setActionError("");
    try {
      await schedulesAPI.update(editingId, formToPayload(editForm, event.date));
      setEditingId(null);
      invalidate();
    } catch {
      setActionError("تعذّر حفظ التعديلات.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportPdf = () => {
    if (!event || schedules.length === 0) return;
    setExportingPdf(true);
    try {
      exportScheduleToPdf(event, schedules, coverage);
    } finally {
      setTimeout(() => setExportingPdf(false), 600);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    setActionError("");
    try {
      await schedulesAPI.delete(id);
      if (editingId === id) setEditingId(null);
      invalidate();
    } catch {
      setActionError("تعذّر حذف النشاط.");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <p className="text-center py-16 text-on-surface-variant px-4">
        تعذّر تحميل الجدول الزمني
      </p>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <EventPageHeader
        eventId={eventId}
        eventTitle={event.title}
        currentLabel="الجدول الزمني"
        eventsBasePath={eventsBasePath}
        subtitle="خط زمني تفاعلي لأنشطة المناسبة — متجاوب مع جميع الشاشات ومتوافق مع ألوان النظام."
      />

      {/* Hero header */}
      <section className="rounded-2xl sm:rounded-3xl border border-outline-variant/10 bg-surface-container-low/60 backdrop-blur-xl p-5 sm:p-8 lg:p-10 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] bg-gradient-to-br from-primary-container via-transparent to-tertiary-container/30 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-on-surface font-headline mb-2">
              الجدول الزمني للفعالية
            </h1>
            <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
              نظّم تسلسل الأحداث: كل نشاط له وقت بداية ونهاية، وموقع عام لجميع القاعات أو موقع مخصص مثل «القاعة 4».
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf || schedules.length === 0}
              className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl border border-outline-variant/20 bg-surface-container-high text-on-surface text-sm font-bold hover:border-primary-container/40 hover:text-primary transition-all inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              title={schedules.length === 0 ? "أضف أنشطة لتصدير الجدول" : "تصدير الجدول الزمني PDF"}
            >
              {exportingPdf ? (
                <span className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              ) : (
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
              )}
              تصدير PDF
            </button>
            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setEditingId(null);
                  setAddForm(emptyScheduleForm());
                  setActionError("");
                }}
                className="px-5 sm:px-8 py-2.5 sm:py-3 rounded-2xl bg-primary-container text-on-primary-container text-sm font-bold shadow-lg shadow-primary-container/25 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                إضافة نشاط
              </button>
            )}
          </div>
        </div>
      </section>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {actionError}
        </div>
      )}

      {/* Filters */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        <div className="lg:col-span-8 rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-2 overflow-x-auto scrollbar-thin">
          <div className="flex gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setLocationFilter("")}
              className={`shrink-0 py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                !locationFilter
                  ? "bg-surface-container-highest text-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              كل الأنشطة
            </button>
            {locationTabs.map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => setLocationFilter(loc)}
                className={`shrink-0 py-2.5 sm:py-3 px-4 sm:px-5 rounded-xl text-xs sm:text-sm font-bold transition-all max-w-[200px] truncate ${
                  locationFilter === loc
                    ? "bg-surface-container-highest text-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 flex items-center px-4 gap-3 min-h-[52px]">
          <span className="material-symbols-outlined text-outline shrink-0">search</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent border-none focus:ring-0 text-on-surface w-full placeholder:text-outline/50 text-sm outline-none min-w-0"
            placeholder="البحث في الجدول..."
            aria-label="البحث في الجدول"
          />
        </div>
      </section>

      {/* Main grid: timeline + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <div className="lg:col-span-8 space-y-5 sm:space-y-6">
          {canManage && adding && (
            <ScheduleActivityForm
              form={addForm}
              onChange={(patch) => setAddForm((f) => ({ ...f, ...patch }))}
              onSave={handleAdd}
              onCancel={() => {
                setAdding(false);
                setAddForm(emptyScheduleForm());
              }}
              saving={saving}
            />
          )}

          {filteredSchedules.length === 0 && !adding ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/25 bg-surface-container-low/50 py-16 sm:py-20 px-6 text-center">
              <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">event_upcoming</span>
              <p className="text-on-surface font-bold text-lg mb-2">لا توجد أنشطة بعد</p>
              <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                {canManage
                  ? "ابدأ بإضافة أول نشاط في الجدول الزمني لهذه المناسبة."
                  : "لم يُضف جدول زمني لهذه المناسبة حتى الآن."}
              </p>
            </div>
          ) : (
            <div className="space-y-1 sm:space-y-2">
              {filteredSchedules.map((item, index) => {
                const isEditing = editingId === item.id;
                return (
                  <ScheduleTimelineItem
                    key={item.id}
                    item={item}
                    index={index}
                    isLast={index === filteredSchedules.length - 1}
                    isActive={isEditing}
                    canManage={canManage}
                    deleting={deletingId === item.id}
                    onEdit={() => startEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                  >
                    {isEditing ? (
                      <ScheduleActivityForm
                        form={editForm}
                        onChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                        onSave={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        onDelete={() => handleDelete(item.id)}
                        saving={saving}
                        deleting={deletingId === item.id}
                        compact
                      />
                    ) : undefined}
                  </ScheduleTimelineItem>
                );
              })}
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 lg:sticky lg:top-24">
          <EventScheduleStats
            activitiesCount={schedules.length}
            plannedMinutes={coverage.plannedMinutes}
            plannedPercent={coverage.percent}
            windowMinutes={coverage.windowMinutes}
            windowLabel={coverage.windowLabel}
            windowSource={coverage.windowSource}
          />
        </aside>
      </div>
    </div>
  );
}
