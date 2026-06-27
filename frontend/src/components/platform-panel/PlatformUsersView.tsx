"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { highlightMatch } from "@/components/events/HighlightText";
import { UserAvatarThumb } from "@/components/common/UserAvatarPicker";
import ToggleSwitch from "@/components/common/ToggleSwitch";
import {
  platformsAPI,
  type PlatformStaffMember,
  type PlatformStaffStats,
} from "@/lib/api";

const emptyStats: PlatformStaffStats = {
  total: 0,
  event_managers: 0,
  event_organizers: 0,
};

type PermKey = "scan_qr" | "edit_guests" | "send_messages";

const PERM_COLUMNS: { key: PermKey; field: keyof PlatformStaffMember; label: string }[] = [
  { key: "scan_qr", field: "perm_scan_qr", label: "مسح QR" },
  { key: "edit_guests", field: "perm_edit_guests", label: "تعديل الضيوف" },
  { key: "send_messages", field: "perm_send_messages", label: "إرسال رسائل" },
];

function statusBadgeClass(status?: string) {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "inactive":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "blocked":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-surface-container-high text-on-surface-variant border-outline-variant/25";
  }
}

function roleBadgeClass(roleKey: string) {
  switch (roleKey) {
    case "event_manager":
      return "bg-primary-container/15 text-primary border-primary-container/30";
    case "event_organizer":
      return "bg-tertiary/15 text-tertiary border-tertiary/30";
    case "coordinator":
      return "bg-secondary-container/15 text-secondary border-secondary-container/30";
    case "entry_manager":
      return "bg-[#5b2eff]/15 text-[#c8bfff] border-[#5b2eff]/30";
    default:
      return "bg-surface-container-high text-on-surface-variant border-outline-variant/25";
  }
}

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

export default function PlatformUsersView() {
  const [staff, setStaff] = useState<PlatformStaffMember[]>([]);
  const [stats, setStats] = useState<PlatformStaffStats>(emptyStats);
  const [filterRoles, setFilterRoles] = useState<{ value: string; label: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ value: string; label: string }[]>([]);
  const [platformName, setPlatformName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await platformsAPI.myStaff();
      setStaff(res.data.staff);
      setStats(res.data.stats);
      setFilterRoles(res.data.filter_roles ?? []);
      setStatusOptions(res.data.status_options ?? []);
      setPlatformName(res.data.platform?.name ?? "");
      setError("");
    } catch {
      setStaff([]);
      setStats(emptyStats);
      setError("تعذّر تحميل أعضاء المنصة.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter && m.role_key !== roleFilter) return false;
      if (statusFilter && m.account_status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        String(m.id),
        m.name,
        m.email,
        m.role_label,
        m.role_key,
        m.coordinator_label ?? "",
        m.status_label ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [staff, search, roleFilter, statusFilter]);

  const handlePermissionToggle = async (
    member: PlatformStaffMember,
    perm: PermKey,
    enabled: boolean
  ) => {
    const toggleKey = `${member.id}-${perm}`;
    setTogglingId(toggleKey);
    try {
      const res = await platformsAPI.myStaffTogglePermission(member.id, perm, enabled);
      setStaff((prev) => prev.map((m) => (m.id === member.id ? { ...m, ...res.data } : m)));
    } catch {
      /* revert visually on next load */
      await load();
    } finally {
      setTogglingId(null);
    }
  };

  const kpiCards = [
    { label: "إجمالي الأعضاء", value: stats.total, icon: "groups" },
    { label: "مدراء الفعاليات", value: stats.event_managers, icon: "supervisor_account" },
    { label: "منظمي الفعاليات", value: stats.event_organizers, icon: "event_available" },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/15">
            <span className="material-symbols-outlined text-tertiary text-xl">groups</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              الأعضاء والطاقم
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              {platformName ? `منصة «${platformName}»` : "إدارة أعضاء منصتك"}
            </p>
          </div>
        </div>
        <Link
          href="/platform/users/add"
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all shrink-0"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          إضافة عضو
        </Link>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-on-surface-variant">{card.label}</span>
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums">{card.value.toLocaleString("ar-SA")}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field sm:w-44"
            >
              <option value="">كل الأدوار</option>
              {filterRoles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field sm:w-44"
            >
              <option value="">كل الحالات</option>
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <p className="text-sm text-on-surface-variant">
            {filtered.length} من {staff.length} عضو
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant">لا توجد نتائج</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[900px]">
              <thead>
                <tr className="text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">
                  <th className="pb-3 px-2">ID</th>
                  <th className="pb-3 px-2">الاسم</th>
                  <th className="pb-3 px-2">الدور</th>
                  <th className="pb-3 px-2">البريد</th>
                  <th className="pb-3 px-2">الحالة</th>
                  <th className="pb-3 px-2">الفعاليات</th>
                  {PERM_COLUMNS.map((p) => (
                    <th key={p.key} className="pb-3 px-2 text-center whitespace-nowrap">{p.label}</th>
                  ))}
                  <th className="pb-3 px-2">تاريخ الإضافة</th>
                  <th className="pb-3 px-2 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filtered.map((member) => (
                  <tr key={member.id} className="hover:bg-surface-container-high/30">
                    <td className="py-3 px-2 text-xs font-mono text-outline">
                      {highlightMatch(String(member.id), search)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <UserAvatarThumb
                          name={member.name}
                          avatarUrl={member.avatar_url}
                          avatarInitial={member.avatar_initial}
                          size="sm"
                        />
                        <span className="font-bold text-sm truncate">
                          {highlightMatch(member.name, search)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${roleBadgeClass(member.role_key)}`}
                      >
                        {highlightMatch(member.role_label, search)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs" dir="ltr">
                      {highlightMatch(member.email, search)}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${statusBadgeClass(member.account_status)}`}
                      >
                        {member.status_label}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs tabular-nums text-center">
                      {member.events_count ?? 0}
                    </td>
                    {PERM_COLUMNS.map((p) => (
                      <td key={p.key} className="py-3 px-2 text-center">
                        <ToggleSwitch
                          size="sm"
                          checked={Boolean(member[p.field])}
                          disabled={togglingId === `${member.id}-${p.key}`}
                          onChange={(v) => handlePermissionToggle(member, p.key, v)}
                          label={p.label}
                        />
                      </td>
                    ))}
                    <td className="py-3 px-2 text-xs text-outline whitespace-nowrap">
                      {formatJoined(member.joined_at)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/platform/users/${member.id}`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10"
                          title="عرض المعلومات"
                        >
                          <span className="material-symbols-outlined text-lg">visibility</span>
                        </Link>
                        <Link
                          href={`/platform/users/${member.id}/edit`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10"
                          title="تعديل"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </Link>
                        <button
                          type="button"
                          title="حذف"
                          onClick={async () => {
                            if (!window.confirm(`حذف ${member.name}؟`)) return;
                            try {
                              await platformsAPI.myStaffRemove(member.id);
                              await load();
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-400/10"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
