"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  platformsAPI,
  type MemberActivityFilters,
  type MemberManagedEventFilters,
  type MemberManagedEventRow,
  type MemberMessageRow,
  type MemberQrScanRow,
  type PlatformMemberProfileResponse,
} from "@/lib/api";

interface PlatformMemberProfileViewProps {
  userId: number;
}

type FilterState = MemberActivityFilters & MemberManagedEventFilters;

const emptyFilters: FilterState = {
  event_id: "",
  date_from: "",
  date_to: "",
  time_from: "",
  time_to: "",
  status: "",
};

function formatJoined(iso: string) {
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

function statusBadgeClass(status?: string) {
  if (status === "active") return "bg-emerald-400/15 text-emerald-400";
  if (status === "blocked") return "bg-red-400/15 text-red-400";
  if (status === "inactive") return "bg-amber-400/15 text-amber-400";
  return "bg-surface-container-high text-on-surface-variant";
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: number;
  accent?: "primary" | "tertiary" | "emerald";
}) {
  const glow =
    accent === "tertiary"
      ? "bg-tertiary/10 group-hover:bg-tertiary/20"
      : accent === "emerald"
        ? "bg-emerald-400/10 group-hover:bg-emerald-400/20"
        : "bg-primary/10 group-hover:bg-primary/20";
  const iconBg =
    accent === "tertiary"
      ? "bg-tertiary-container/20 text-tertiary"
      : accent === "emerald"
        ? "bg-emerald-400/15 text-emerald-400"
        : "bg-primary-container/20 text-primary-fixed-dim";

  return (
    <div className="bg-surface-container-high p-5 sm:p-6 rounded-2xl relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
      <div className={`absolute -right-4 -top-4 w-24 h-24 ${glow} rounded-full blur-2xl transition-all`} />
      <div className="flex items-start gap-3 relative z-10">
        <div className={`p-3 rounded-xl ${iconBg}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm font-medium mb-1">{label}</p>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-on-surface font-headline">
            {value.toLocaleString("ar-SA")}
          </h3>
        </div>
      </div>
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  onApply,
  onReset,
  eventOptions,
  statusOptions,
  showEvent,
  showTime,
  showStatus,
  loading,
}: {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  onApply: () => void;
  onReset: () => void;
  eventOptions: { id: number; title: string }[];
  statusOptions?: { value: string; label: string }[];
  showEvent?: boolean;
  showTime?: boolean;
  showStatus?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {showEvent && (
          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">الفعالية</span>
            <select
              className="input-field w-full text-sm"
              value={filters.event_id ?? ""}
              onChange={(e) => onChange({ ...filters, event_id: e.target.value })}
            >
              <option value="">كل الفعاليات</option>
              {eventOptions.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>
          </label>
        )}
        {showStatus && statusOptions && (
          <label className="space-y-1">
            <span className="text-xs text-on-surface-variant">حالة الفعالية</span>
            <select
              className="input-field w-full text-sm"
              value={filters.status ?? ""}
              onChange={(e) => onChange({ ...filters, status: e.target.value })}
            >
              <option value="">كل الحالات</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>
        )}
        <label className="space-y-1">
          <span className="text-xs text-on-surface-variant">من تاريخ</span>
          <input
            type="date"
            className="input-field w-full text-sm"
            value={filters.date_from ?? ""}
            onChange={(e) => onChange({ ...filters, date_from: e.target.value })}
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs text-on-surface-variant">إلى تاريخ</span>
          <input
            type="date"
            className="input-field w-full text-sm"
            value={filters.date_to ?? ""}
            onChange={(e) => onChange({ ...filters, date_to: e.target.value })}
          />
        </label>
        {showTime && (
          <>
            <label className="space-y-1">
              <span className="text-xs text-on-surface-variant">من وقت</span>
              <input
                type="time"
                className="input-field w-full text-sm"
                value={filters.time_from ?? ""}
                onChange={(e) => onChange({ ...filters, time_from: e.target.value })}
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-on-surface-variant">إلى وقت</span>
              <input
                type="time"
                className="input-field w-full text-sm"
                value={filters.time_to ?? ""}
                onChange={(e) => onChange({ ...filters, time_to: e.target.value })}
              />
            </label>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApply}
          disabled={loading}
          className="btn-primary text-sm px-4 py-2 rounded-xl disabled:opacity-60"
        >
          تطبيق الفلتر
        </button>
        <button
          type="button"
          onClick={onReset}
          className="text-sm px-4 py-2 rounded-xl border border-outline-variant/20 text-on-surface-variant hover:text-on-surface"
        >
          إعادة تعيين
        </button>
      </div>
    </div>
  );
}

function DataTableSection({
  title,
  icon,
  total,
  expanded,
  onToggleExpand,
  filters,
  onFiltersChange,
  onApplyFilters,
  onResetFilters,
  eventOptions,
  statusOptions,
  showEventFilter,
  showTimeFilter,
  showStatusFilter,
  loading,
  emptyText,
  children,
}: {
  title: string;
  icon: string;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  filters: FilterState;
  onFiltersChange: (f: FilterState) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
  eventOptions: { id: number; title: string }[];
  statusOptions?: { value: string; label: string }[];
  showEventFilter?: boolean;
  showTimeFilter?: boolean;
  showStatusFilter?: boolean;
  loading?: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 sm:p-6 border-b border-outline-variant/10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary-container/20 text-primary-fixed-dim">
            <span className="material-symbols-outlined">{icon}</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-on-surface">{title}</h2>
            <p className="text-sm text-on-surface-variant">الإجمالي: {total.toLocaleString("ar-SA")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary-container/10 px-4 py-2 rounded-xl transition-colors"
        >
          <span className="material-symbols-outlined text-lg">
            {expanded ? "visibility_off" : "visibility"}
          </span>
          {expanded ? "عرض المعاينة" : "عرض الكل"}
        </button>
      </div>

      {expanded && (
        <div className="p-5 sm:p-6 space-y-4 border-b border-outline-variant/10">
          <FilterBar
            filters={filters}
            onChange={onFiltersChange}
            onApply={onApplyFilters}
            onReset={onResetFilters}
            eventOptions={eventOptions}
            statusOptions={statusOptions}
            showEvent={showEventFilter}
            showTime={showTimeFilter}
            showStatus={showStatusFilter}
            loading={loading}
          />
        </div>
      )}

      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="animate-spin w-8 h-8 border-4 border-primary-container border-t-transparent rounded-full" />
          </div>
        ) : (
          children
        )}
        {!loading && total === 0 && (
          <p className="text-center text-on-surface-variant py-10 text-sm">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

export default function PlatformMemberProfileView({ userId }: PlatformMemberProfileViewProps) {
  const [profile, setProfile] = useState<PlatformMemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const [messagesExpanded, setMessagesExpanded] = useState(false);
  const [messagesFilters, setMessagesFilters] = useState<FilterState>({ ...emptyFilters });
  const [messagesRows, setMessagesRows] = useState<MemberMessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [scansExpanded, setScansExpanded] = useState(false);
  const [scansFilters, setScansFilters] = useState<FilterState>({ ...emptyFilters });
  const [scansRows, setScansRows] = useState<MemberQrScanRow[]>([]);
  const [scansLoading, setScansLoading] = useState(false);

  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [eventsFilters, setEventsFilters] = useState<FilterState>({ ...emptyFilters });
  const [eventsRows, setEventsRows] = useState<MemberManagedEventRow[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await platformsAPI.myStaffProfile(userId);
      setProfile(res.data);
      setMessagesRows(res.data.messages_preview);
      setScansRows(res.data.qr_scans_preview);
      setEventsRows(res.data.managed_events_preview);
    } catch (err: unknown) {
      const detail =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data
          ? String(err.response.data.detail)
          : null;
      setError(detail || "تعذّر تحميل معلومات العضو");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const buildActivityParams = (filters: FilterState): MemberActivityFilters => {
    const params: MemberActivityFilters = {};
    if (filters.event_id) params.event_id = filters.event_id;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filters.time_from) params.time_from = filters.time_from;
    if (filters.time_to) params.time_to = filters.time_to;
    return params;
  };

  const loadMessages = async (filters: FilterState) => {
    setMessagesLoading(true);
    try {
      const res = await platformsAPI.myStaffMessages(userId, buildActivityParams(filters));
      setMessagesRows(res.data.messages);
    } finally {
      setMessagesLoading(false);
    }
  };

  const loadScans = async (filters: FilterState) => {
    setScansLoading(true);
    try {
      const res = await platformsAPI.myStaffQrScans(userId, buildActivityParams(filters));
      setScansRows(res.data.qr_scans);
    } finally {
      setScansLoading(false);
    }
  };

  const loadManagedEvents = async (filters: FilterState) => {
    setEventsLoading(true);
    try {
      const params: MemberManagedEventFilters = {};
      if (filters.status) params.status = filters.status;
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      const res = await platformsAPI.myStaffManagedEvents(userId, params);
      setEventsRows(res.data.events);
    } finally {
      setEventsLoading(false);
    }
  };

  const handleExport = async (format: "xlsx" | "pdf") => {
    setExporting(format);
    try {
      const res = await platformsAPI.myStaffExport(userId, format);
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${profile?.member.name ?? "member"}_report.${format === "pdf" ? "pdf" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setExporting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="px-4 py-16 text-center space-y-4 max-w-lg mx-auto">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant">error</span>
        <p className="text-on-surface-variant">{error || "لا توجد بيانات"}</p>
        {userId <= 0 && (
          <p className="text-xs text-amber-400">معرّف العضو غير صالح — أعد فتح الصفحة من قائمة الأعضاء.</p>
        )}
        <Link href="/platform/users" className="text-primary hover:underline text-sm">
          العودة إلى الأعضاء
        </Link>
      </div>
    );
  }

  const member = profile.member;
  const eventOptions = profile.event_options;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4">
        <Link
          href="/platform/users"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          العودة إلى الأعضاء
        </Link>

        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4 sm:gap-5">
              {member.avatar_url ? (
                <img
                  src={member.avatar_url}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary-container/30 flex items-center justify-center text-2xl font-bold text-primary">
                  {member.avatar_initial}
                </div>
              )}
              <div className="space-y-2 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline truncate">
                  {member.name}
                </h1>
                <p className="text-sm text-on-surface-variant truncate">{member.email}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary-container/25 text-primary-fixed-dim">
                    {member.role_label || member.role}
                  </span>
                  <span
                    className={`text-xs font-semibold px-3 py-1 rounded-full ${statusBadgeClass(member.account_status)}`}
                  >
                    {member.status_label ?? "نشط"}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    انضم {formatJoined(member.joined_at)}
                  </span>
                </div>
                {member.coordinator_label && (
                  <p className="text-xs text-on-surface-variant">
                    نوع المنسق: {member.coordinator_label}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              <Link
                href={`/platform/users/${userId}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/20 text-sm font-medium hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                تعديل
              </Link>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport("xlsx")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg">table</span>
                {exporting === "xlsx" ? "جاري التصدير..." : "Excel"}
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport("pdf")}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-container/25 text-primary text-sm font-medium hover:bg-primary-container/40 transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                {exporting === "pdf" ? "جاري التصدير..." : "PDF"}
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {member.perm_scan_qr && (
              <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                مسح QR
              </span>
            )}
            {member.perm_edit_guests && (
              <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                تعديل الضيوف
              </span>
            )}
            {member.perm_send_messages && (
              <span className="text-xs px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant">
                إرسال رسائل
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon="event"
          label="إجمالي الفعاليات"
          value={profile.event_stats.total}
        />
        <StatCard
          icon="play_circle"
          label="فعاليات نشطة"
          value={profile.event_stats.active}
          accent="emerald"
        />
        <StatCard
          icon="task_alt"
          label="فعاليات مكتملة"
          value={profile.event_stats.completed}
          accent="tertiary"
        />
      </div>

      {profile.sections.show_messages && (
        <DataTableSection
          title="الرسائل المرسلة"
          icon="mail"
          total={profile.messages_total}
          expanded={messagesExpanded}
          onToggleExpand={() => {
            const next = !messagesExpanded;
            setMessagesExpanded(next);
            if (!next) setMessagesRows(profile.messages_preview);
            else loadMessages(messagesFilters);
          }}
          filters={messagesFilters}
          onFiltersChange={setMessagesFilters}
          onApplyFilters={() => loadMessages(messagesFilters)}
          onResetFilters={() => {
            setMessagesFilters({ ...emptyFilters });
            loadMessages({ ...emptyFilters });
          }}
          eventOptions={eventOptions}
          showEventFilter
          showTimeFilter
          loading={messagesLoading}
          emptyText="لا توجد رسائل مرسلة"
        >
          {messagesRows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs border-b border-outline-variant/10">
                  <th className="py-3 px-4 text-right font-medium">ID</th>
                  <th className="py-3 px-4 text-right font-medium">الضيف</th>
                  <th className="py-3 px-4 text-right font-medium">الفعالية</th>
                  <th className="py-3 px-4 text-right font-medium">التاريخ</th>
                  <th className="py-3 px-4 text-right font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {(messagesExpanded ? messagesRows : messagesRows.slice(0, 10)).map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/5 hover:bg-surface-container-high/50">
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-xs">{row.id}</td>
                    <td className="py-3 px-4 text-on-surface">{row.guest_name}</td>
                    <td className="py-3 px-4 text-on-surface-variant">{row.event_title}</td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableSection>
      )}

      {profile.sections.show_qr_scans && (
        <DataTableSection
          title="عمليات مسح QR"
          icon="qr_code_scanner"
          total={profile.qr_scans_total}
          expanded={scansExpanded}
          onToggleExpand={() => {
            const next = !scansExpanded;
            setScansExpanded(next);
            if (!next) setScansRows(profile.qr_scans_preview);
            else loadScans(scansFilters);
          }}
          filters={scansFilters}
          onFiltersChange={setScansFilters}
          onApplyFilters={() => loadScans(scansFilters)}
          onResetFilters={() => {
            setScansFilters({ ...emptyFilters });
            loadScans({ ...emptyFilters });
          }}
          eventOptions={eventOptions}
          showEventFilter
          showTimeFilter
          loading={scansLoading}
          emptyText="لا توجد عمليات مسح"
        >
          {scansRows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-on-surface-variant text-xs border-b border-outline-variant/10">
                  <th className="py-3 px-4 text-right font-medium">ID</th>
                  <th className="py-3 px-4 text-right font-medium">الضيف</th>
                  <th className="py-3 px-4 text-right font-medium">الفعالية</th>
                  <th className="py-3 px-4 text-right font-medium">التاريخ</th>
                  <th className="py-3 px-4 text-right font-medium">الوقت</th>
                </tr>
              </thead>
              <tbody>
                {(scansExpanded ? scansRows : scansRows.slice(0, 10)).map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/5 hover:bg-surface-container-high/50">
                    <td className="py-3 px-4 text-on-surface-variant font-mono text-xs">{row.id}</td>
                    <td className="py-3 px-4 text-on-surface">{row.guest_name}</td>
                    <td className="py-3 px-4 text-on-surface-variant">{row.event_title}</td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableSection>
      )}

      {profile.sections.show_managed_events && (
        <DataTableSection
          title="الفعاليات المُدارة"
          icon="dashboard"
          total={profile.managed_events_total}
          expanded={eventsExpanded}
          onToggleExpand={() => {
            const next = !eventsExpanded;
            setEventsExpanded(next);
            if (!next) setEventsRows(profile.managed_events_preview);
            else loadManagedEvents(eventsFilters);
          }}
          filters={eventsFilters}
          onFiltersChange={setEventsFilters}
          onApplyFilters={() => loadManagedEvents(eventsFilters)}
          onResetFilters={() => {
            setEventsFilters({ ...emptyFilters });
            loadManagedEvents({ ...emptyFilters });
          }}
          eventOptions={eventOptions}
          statusOptions={profile.status_options}
          showStatusFilter
          loading={eventsLoading}
          emptyText="لا توجد فعاليات مُدارة"
        >
          {eventsRows.length > 0 && (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-on-surface-variant text-xs border-b border-outline-variant/10">
                  <th className="py-3 px-4 text-right font-medium">الفعالية</th>
                  <th className="py-3 px-4 text-right font-medium">الحالة</th>
                  <th className="py-3 px-4 text-right font-medium">التاريخ</th>
                  <th className="py-3 px-4 text-right font-medium">الضيوف</th>
                  <th className="py-3 px-4 text-right font-medium">مؤكد</th>
                  <th className="py-3 px-4 text-right font-medium">حضر</th>
                  <th className="py-3 px-4 text-right font-medium">اعتذر</th>
                  <th className="py-3 px-4 text-right font-medium">تأكيد %</th>
                  <th className="py-3 px-4 text-right font-medium">غياب %</th>
                </tr>
              </thead>
              <tbody>
                {(eventsExpanded ? eventsRows : eventsRows.slice(0, 10)).map((row) => (
                  <tr key={row.id} className="border-b border-outline-variant/5 hover:bg-surface-container-high/50">
                    <td className="py-3 px-4 text-on-surface font-medium">{row.title}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 rounded-lg bg-surface-container-high text-on-surface-variant">
                        {row.status_label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{row.date}</td>
                    <td className="py-3 px-4 text-on-surface">{row.guests_total}</td>
                    <td className="py-3 px-4 text-on-surface">{row.confirmed}</td>
                    <td className="py-3 px-4 text-emerald-400">{row.attended}</td>
                    <td className="py-3 px-4 text-rose-400">{row.declined}</td>
                    <td className="py-3 px-4 text-on-surface">{row.confirmation_rate}%</td>
                    <td className="py-3 px-4 text-on-surface-variant">{row.absence_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DataTableSection>
      )}
    </div>
  );
}
