"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { highlightMatch } from "@/components/events/HighlightText";
import type { PlatformStaffMember, PlatformStaffStats } from "@/lib/api";

interface StaffMembersViewProps {
  title: string;
  subtitle: string;
  staff: PlatformStaffMember[];
  stats: PlatformStaffStats;
  roleOptions: { value: string; label: string }[];
  platformOptions?: { value: string; label: string }[];
  showPlatformColumn?: boolean;
  backHref?: string;
  backLabel?: string;
  searchPlaceholder?: string;
  listTitle?: string;
}

function roleBadgeClass(roleKey: string) {
  switch (roleKey) {
    case "event_manager":
      return "bg-primary-container/15 text-primary border-primary-container/30";
    case "event_organizer":
      return "bg-tertiary/15 text-tertiary border-tertiary/30";
    case "platform_member":
      return "bg-secondary-container/15 text-secondary border-secondary-container/30";
    case "staff":
      return "bg-surface-container-high text-on-surface-variant border-outline-variant/25";
    case "platform_owner":
      return "bg-[#5b2eff]/15 text-[#c8bfff] border-[#5b2eff]/30";
    default:
      return "bg-primary-container/10 text-primary border-primary-container/25";
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

export default function StaffMembersView({
  title,
  subtitle,
  staff,
  stats,
  roleOptions,
  platformOptions = [],
  showPlatformColumn = false,
  backHref,
  backLabel,
  searchPlaceholder = "بحث باسم العضو...",
  listTitle = "قائمة الاستاف",
}: StaffMembersViewProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [platformFilter, setPlatformFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (roleFilter && m.role_key !== roleFilter) return false;
      if (platformFilter && String(m.platform_id) !== platformFilter) return false;
      if (!q) return true;
      const haystack = [
        String(m.id),
        m.name,
        m.email,
        m.role_label,
        m.role_key,
        m.platform_name ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [staff, search, roleFilter, platformFilter]);

  const kpiCards = [
    { label: "إجمالي الأعضاء", value: stats.total, icon: "groups", color: "primary" },
    { label: "مدراء الفعاليات", value: stats.event_managers, icon: "supervisor_account", color: "primary" },
    { label: "منظمي الفعاليات", value: stats.event_organizers, icon: "event_available", color: "tertiary" },
  ];

  const hasActiveFilters = search.trim() || roleFilter || platformFilter;

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("");
    setPlatformFilter("");
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      <div>
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-3 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            {backLabel}
          </Link>
        )}
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-tertiary/15 shadow-lg shadow-tertiary/10">
            <span className="material-symbols-outlined text-tertiary text-xl">groups</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">{title}</h1>
            <p className="text-sm text-on-surface-variant mt-1">{subtitle}</p>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 relative overflow-hidden group hover:border-primary-container/25 transition-colors"
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full -mr-10 -mt-10 ${
                card.color === "tertiary" ? "bg-tertiary/10" : "bg-primary-container/10"
              }`}
            />
            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-xs font-bold text-on-surface-variant">{card.label}</span>
              <span
                className={`material-symbols-outlined ${
                  card.color === "tertiary" ? "text-tertiary" : "text-primary"
                }`}
              >
                {card.icon}
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-on-surface font-headline relative z-10 tabular-nums">
              {card.value.toLocaleString("ar-SA")}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-on-surface sm:text-xl">{listTitle}</h3>
              <p className="text-sm text-on-surface-variant">
                {filtered.length.toLocaleString("ar-SA")} من {staff.length.toLocaleString("ar-SA")} عضو
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mr-2 text-primary hover:underline text-xs font-bold"
                  >
                    مسح الفلاتر
                  </button>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="input-field pr-10 w-full"
                aria-label="بحث في الأعضاء"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {platformOptions.length > 0 && (
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="input-field sm:w-44"
                  aria-label="فلترة المنصة"
                >
                  <option value="">كل المنصات</option>
                  {platformOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="input-field sm:w-44"
                aria-label="فلترة الدور"
              >
                <option value="">كل الأدوار</option>
                {roleOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {roleOptions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRoleFilter("")}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    !roleFilter
                      ? "bg-primary-container text-on-primary-container border-primary-container"
                      : "bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-primary-container/30"
                  }`}
                >
                  كل الأدوار
                </button>
                {roleOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setRoleFilter(o.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      roleFilter === o.value
                        ? "bg-primary-container text-on-primary-container border-primary-container"
                        : "bg-surface-container-high text-on-surface-variant border-outline-variant/20 hover:border-primary-container/30"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-40 mb-3 block">person_off</span>
            <p>لا توجد نتائج مطابقة</p>
          </div>
        ) : (
          <>
            {/* بطاقات — شاشات صغيرة ومتوسطة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:hidden">
              {filtered.map((member) => (
                <article
                  key={`card-${member.platform_id ?? 0}-${member.id}`}
                  className="rounded-xl border border-outline-variant/10 bg-surface-container/40 p-4 hover:border-primary-container/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-tertiary-container/25 text-tertiary font-bold text-sm flex items-center justify-center shrink-0">
                      {member.avatar_initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-on-surface truncate">
                        {highlightMatch(member.name, search)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate mt-0.5" dir="ltr">
                        {highlightMatch(member.email, search)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${roleBadgeClass(member.role_key)}`}
                        >
                          {highlightMatch(member.role_label, search)}
                        </span>
                        <span className="text-[10px] text-outline font-mono">
                          #{highlightMatch(String(member.id), search)}
                        </span>
                      </div>
                      {showPlatformColumn && member.platform_name && (
                        <p className="text-xs text-on-surface-variant mt-2">
                          {highlightMatch(member.platform_name, search)}
                        </p>
                      )}
                      <p className="text-[10px] text-outline mt-2">
                        {formatJoined(member.joined_at)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* جدول — شاشات كبيرة */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="text-xs font-bold text-on-surface-variant border-b border-outline-variant/10">
                    <th className="pb-4 px-3">ID</th>
                    <th className="pb-4 px-3">الاسم</th>
                    {showPlatformColumn && <th className="pb-4 px-3">المنصة</th>}
                    <th className="pb-4 px-3">الدور</th>
                    <th className="pb-4 px-3">تاريخ الإضافة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filtered.map((member) => (
                    <tr
                      key={`row-${member.platform_id ?? 0}-${member.id}`}
                      className="hover:bg-surface-container-high/40 transition-colors"
                    >
                      <td className="py-3 px-3 text-xs font-mono text-outline tabular-nums">
                        {highlightMatch(String(member.id), search)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-tertiary-container/25 text-tertiary font-bold text-sm flex items-center justify-center shrink-0">
                            {member.avatar_initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-on-surface truncate">
                              {highlightMatch(member.name, search)}
                            </p>
                            <p className="text-[10px] text-on-surface-variant truncate" dir="ltr">
                              {highlightMatch(member.email, search)}
                            </p>
                          </div>
                        </div>
                      </td>
                      {showPlatformColumn && (
                        <td className="py-3 px-3 text-sm text-on-surface-variant">
                          {member.platform_name ? (
                            <Link
                              href={`/platforms/${member.platform_id}`}
                              className="hover:text-primary transition-colors font-medium"
                            >
                              {highlightMatch(member.platform_name, search)}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-full border ${roleBadgeClass(member.role_key)}`}
                        >
                          {highlightMatch(member.role_label, search)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-on-surface-variant">
                        {formatJoined(member.joined_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
