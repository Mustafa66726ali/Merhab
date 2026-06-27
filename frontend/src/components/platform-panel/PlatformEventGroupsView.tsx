"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { highlightMatch } from "@/components/events/HighlightText";
import EventPageHeader from "@/components/platform-panel/EventPageHeader";
import {
  eventsAPI,
  groupsAPI,
  type EventGroupOverviewItem,
  type EventGroupsOverviewResponse,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

const GROUP_STATUS_FILTERS = [
  { value: "", label: "جميع الحالات" },
  { value: "full", label: "مؤكد بالكامل" },
  { value: "pending", label: "لم يتم الرد" },
  { value: "partial", label: "تأكيد جزئي" },
] as const;

function groupIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("عائلة") || n.includes("family")) return "family_restroom";
  if (n.includes("عمل") || n.includes("تجارة")) return "business_center";
  if (n.includes("إعلام") || n.includes("صح")) return "workspace_premium";
  return "diversity_3";
}

function GroupCard({
  group,
  search,
}: {
  group: EventGroupOverviewItem;
  search: string;
}) {
  const isFull = group.guests_total > 0 && group.guests_confirmed >= group.guests_total;
  const rate = group.confirmation_rate;

  return (
    <article
      className="bg-surface-container-high rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 border border-outline-variant/10 relative overflow-hidden group hover:border-primary-container/25 transition-colors"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex justify-between items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-surface-container-highest flex items-center justify-center text-primary-fixed-dim shrink-0">
          <span className="material-symbols-outlined">{groupIcon(group.name)}</span>
        </div>
        {group.section_name && (
          <span
            className="px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider shrink-0"
            style={{
              backgroundColor: `${group.section_color || "#5b2eff"}18`,
              color: group.section_color || "#c8bfff",
            }}
          >
            {highlightMatch(group.section_name, search)}
          </span>
        )}
      </div>

      <h4 className="text-xl sm:text-2xl font-bold text-on-surface mb-2 line-clamp-2">
        {highlightMatch(group.name, search)}
      </h4>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-on-surface-variant mb-6 sm:mb-8 text-sm">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">person</span>
          <span className="font-medium tabular-nums">{group.guests_total} ضيف</span>
        </span>
        {group.guests_total > 0 && (
          <>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            <span className="flex items-center gap-1 text-tertiary">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span className="font-medium tabular-nums">
                {group.guests_confirmed} تم التأكيد
              </span>
            </span>
          </>
        )}
      </div>

      <div className="mb-6 sm:mb-8">
        <div className="flex justify-between text-xs font-bold mb-2">
          <span className="text-on-surface-variant">
            {isFull ? "تم التأكيد بالكامل" : "نسبة الحضور"}
          </span>
          <span className={isFull ? "text-tertiary" : "text-primary"}>{rate}%</span>
        </div>
        <div className="h-2 w-full bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFull
                ? "bg-tertiary shadow-[0_0_10px_rgba(255,181,155,0.35)]"
                : "bg-gradient-to-r from-primary-container to-primary shadow-[0_0_10px_rgba(91,46,255,0.25)]"
            }`}
            style={{ width: `${rate}%` }}
          />
        </div>
      </div>

      {isFull ? (
        <div className="bg-tertiary/10 border border-tertiary/20 rounded-2xl p-4 flex items-center gap-3">
          <span
            className="material-symbols-outlined text-tertiary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            auto_awesome
          </span>
          <p className="text-sm font-semibold text-tertiary">
            اكتملت جميع التأكيدات لهذه المجموعة
          </p>
        </div>
      ) : group.guests_pending > 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-on-surface-variant">pending_actions</span>
          <p className="text-sm text-on-surface-variant">
            {group.guests_pending} ضيف في انتظار الرد
          </p>
        </div>
      ) : group.guests_total === 0 ? (
        <div className="bg-surface-container-lowest rounded-2xl p-4 text-sm text-on-surface-variant">
          لا يوجد ضيوف في هذه المجموعة بعد
        </div>
      ) : (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
          <p className="text-sm font-semibold text-primary tabular-nums">
            {group.guests_confirmed} من {group.guests_total} أكّدوا الحضور
          </p>
        </div>
      )}
    </article>
  );
}

interface PlatformEventGroupsViewProps {
  eventId: number;
  eventsBasePath?: string;
}

export default function PlatformEventGroupsView({
  eventId,
  eventsBasePath = "/platform/events",
}: PlatformEventGroupsViewProps) {
  const user = useAuthStore((s) => s.user);
  const canManageGroups = user?.role === "event_manager";
  const [data, setData] = useState<EventGroupsOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [exporting, setExporting] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await eventsAPI.groupsOverview(eventId);
      setData(res.data);
      setError("");
    } catch {
      setData(null);
      setError("تعذّر تحميل المجموعات والأقسام.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.groups.filter((g) => {
      if (sectionFilter && String(g.section_id ?? "") !== sectionFilter) return false;
      if (statusFilter === "full" && (g.guests_total === 0 || g.guests_confirmed < g.guests_total)) {
        return false;
      }
      if (statusFilter === "pending" && g.guests_pending === 0) return false;
      if (
        statusFilter === "partial" &&
        (g.guests_total === 0 ||
          g.guests_confirmed === 0 ||
          g.guests_confirmed >= g.guests_total)
      ) {
        return false;
      }
      if (!q) return true;
      const haystack = [g.name, g.section_name, g.description].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [data, search, sectionFilter, statusFilter]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await eventsAPI.exportGroupsGuests(eventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `event-${eventId}-groups-guests.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر تصدير البيانات.");
    } finally {
      setExporting(false);
    }
  };

  const activeSectionId = useMemo(() => {
    if (sectionFilter) return Number(sectionFilter);
    const sections = data?.sections ?? [];
    if (sections.length === 1) return sections[0].id;
    return null;
  }, [sectionFilter, data?.sections]);

  const activeSectionLabel = useMemo(() => {
    if (!activeSectionId) return null;
    const section = (data?.sections ?? []).find((s) => s.id === activeSectionId);
    return section?.name ?? null;
  }, [activeSectionId, data?.sections]);

  const openAddGroupModal = () => {
    setGroupName("");
    setGroupModalOpen(true);
  };

  const handleAddGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      setError("اسم المجموعة مطلوب.");
      return;
    }
    if (!activeSectionId) {
      setError("اختر القسم من فلاتر الأعلى قبل إضافة مجموعة.");
      return;
    }
    const section = (data?.sections ?? []).find((s) => s.id === activeSectionId);
    setSavingGroup(true);
    setError("");
    try {
      await groupsAPI.create({
        event: eventId,
        section: activeSectionId,
        name,
        color: section?.color || "#5b2eff",
      });
      setGroupModalOpen(false);
      setGroupName("");
      await load();
    } catch {
      setError("تعذّر إضافة المجموعة.");
    } finally {
      setSavingGroup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-16 text-center text-on-surface-variant">
        {error}
      </div>
    );
  }

  const stats = data?.stats;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <EventPageHeader
            eventId={eventId}
            eventTitle={data?.event.title}
            currentLabel="المجموعات والأقسام"
            eventsBasePath={eventsBasePath}
          />
          <p className="text-primary font-bold tracking-widest text-xs uppercase">
            إدارة المجموعات
          </p>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-on-surface tracking-tight font-headline">
            نظرة عامة على المجموعات
          </h1>
          <p className="text-on-surface-variant max-w-lg text-sm sm:text-base leading-relaxed">
            تتبع مجموعات الضيوف وحالة تأكيد الحضور لكل قسم من أقسام المناسبة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0 self-start lg:self-auto">
          {canManageGroups && (
            <button
              type="button"
              onClick={openAddGroupModal}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:brightness-110 transition-all"
              title="إضافة مجموعة"
            >
              <span className="material-symbols-outlined text-lg">group_add</span>
              إضافة مجموعة
            </button>
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="px-5 sm:px-6 py-3 rounded-xl border border-outline-variant/30 text-on-surface font-semibold hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            {exporting ? "جاري التصدير..." : "تصدير البيانات"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {[
          {
            icon: "groups",
            label: "إجمالي المجموعات",
            value: stats?.groups_total ?? 0,
            wrap: "bg-primary/10 text-primary",
          },
          {
            icon: "verified",
            label: "تأكيد الحضور",
            value: stats?.confirmed_total ?? 0,
            wrap: "bg-tertiary/10 text-tertiary",
          },
          {
            icon: "pending_actions",
            label: "في انتظار الرد",
            value: stats?.pending_total ?? 0,
            wrap: "bg-primary-container/10 text-primary-fixed-dim",
          },
          {
            icon: "person_off",
            label: "المعتذرون",
            value: stats?.declined_total ?? 0,
            wrap: "bg-error/10 text-error",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-container-low p-4 sm:p-6 rounded-2xl flex items-center gap-4 sm:gap-5 border border-outline-variant/5"
          >
            <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${card.wrap}`}>
              <span className="material-symbols-outlined text-2xl sm:text-3xl">{card.icon}</span>
            </div>
            <div>
              <p className="text-on-surface-variant text-xs sm:text-sm mb-1">{card.label}</p>
              <p className="text-xl sm:text-2xl font-black text-on-surface tabular-nums">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface-container-low rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-outline-variant/10">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
            <div>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-2">
                فرز حسب القسم
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSectionFilter("")}
                  className={`px-4 py-2 font-bold rounded-full text-xs transition-colors ${
                    !sectionFilter
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  الكل
                </button>
                {(data?.sections ?? []).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSectionFilter(String(s.id))}
                    className={`px-4 py-2 font-bold rounded-full text-xs transition-colors ${
                      sectionFilter === String(s.id)
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden lg:block h-10 w-px bg-outline-variant/20" />
            <div>
              <p className="text-[10px] uppercase font-bold text-on-surface-variant tracking-widest mb-2">
                عرض الحالة
              </p>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-surface-container-high border border-outline-variant/10 text-xs font-bold text-on-surface rounded-full px-5 py-2.5 focus:ring-1 focus:ring-primary outline-none"
              >
                {GROUP_STATUS_FILTERS.map((f) => (
                  <option key={f.value || "all"} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative w-full lg:w-80">
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="البحث عن مجموعة أو ضيف..."
              className="w-full bg-surface-container-lowest border border-outline-variant/10 rounded-full py-3 pr-12 pl-6 text-sm focus:ring-2 focus:ring-primary/50 text-on-surface placeholder:text-on-surface-variant/50 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Group cards */}
      {filteredGroups.length === 0 ? (
        <div className="py-16 text-center text-on-surface-variant rounded-2xl border border-outline-variant/10 bg-surface-container-low">
          لا توجد مجموعات مطابقة
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-8">
          {filteredGroups.map((group) => (
            <GroupCard key={group.id} group={group} search={search} />
          ))}
        </div>
      )}

      {groupModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !savingGroup && setGroupModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
              <h2 className="font-bold text-on-surface text-lg">إضافة مجموعة</h2>
              <button
                type="button"
                onClick={() => !savingGroup && setGroupModalOpen(false)}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {activeSectionLabel && (
                <div className="rounded-xl bg-surface-container-high/60 px-4 py-3 border border-outline-variant/10">
                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider mb-1">
                    القسم
                  </p>
                  <p className="font-bold text-on-surface">{activeSectionLabel}</p>
                </div>
              )}
              {!activeSectionId && (
                <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                  اختر القسم من فلاتر «فرز حسب القسم» أعلاه ثم أضف المجموعة.
                </p>
              )}
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  اسم المجموعة
                </label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="مثال: عائلة العميد"
                  className="w-full px-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/10">
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                disabled={savingGroup}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold text-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={savingGroup || !activeSectionId}
                className="flex-1 py-2.5 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm disabled:opacity-50"
              >
                {savingGroup ? "جاري الإضافة..." : "إضافة المجموعة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
