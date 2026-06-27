"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { platformsAPI, type EventManagerTeamMember } from "@/lib/api";

export default function EventManagerTeamView() {
  const [team, setTeam] = useState<EventManagerTeamMember[]>([]);
  const [stats, setStats] = useState({ total: 0, organizers: 0, coordinators: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | "event_organizer" | "coordinator">("");
  const [eventFilter, setEventFilter] = useState("");

  useEffect(() => {
    platformsAPI
      .myMemberTeam()
      .then((r) => {
        setTeam(r.data.team);
        setStats(r.data.stats);
      })
      .catch(() => {
        setTeam([]);
        setStats({ total: 0, organizers: 0, coordinators: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  const eventOptions = useMemo(() => {
    const map = new Map<number, string>();
    team.forEach((m) => map.set(m.event_id, m.event_title));
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "ar"))
      .map(([id, title]) => ({ id, title }));
  }, [team]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return team.filter((m) => {
      if (roleFilter && m.role_key !== roleFilter) return false;
      if (eventFilter && String(m.event_id) !== eventFilter) return false;
      if (!q) return true;
      const hay = [String(m.id), m.name, m.email, m.event_title, m.role_label]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [team, search, roleFilter, eventFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
          فريق الفعاليات
        </h1>
        <p className="text-sm text-on-surface-variant mt-2 max-w-2xl leading-relaxed">
          منظمي الفعاليات والمنسقين (مع نوع المنسق) على منصتك — لا يُعرض طاقم النظام كامل.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-4 sm:p-5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            إجمالي السجلات
          </p>
          <p className="text-2xl font-black text-on-surface tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-4 sm:p-5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            منظم فعالية
          </p>
          <p className="text-2xl font-black text-primary tabular-nums">{stats.organizers}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-4 sm:p-5">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
            منسقين
          </p>
          <p className="text-2xl font-black text-tertiary tabular-nums">{stats.coordinators}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        <div className="md:col-span-5 relative">
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم، البريد، المناسبة..."
            className="w-full h-12 pr-12 pl-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as "" | "event_organizer" | "coordinator")
            }
            className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
          >
            <option value="">كل الأدوار</option>
            <option value="event_organizer">منظم فعالية</option>
            <option value="coordinator">منسق</option>
          </select>
        </div>
        <div className="md:col-span-4">
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="w-full h-12 px-4 bg-surface-container-low border border-outline-variant/10 rounded-2xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 appearance-none"
          >
            <option value="">جميع المناسبات</option>
            {eventOptions.map((e) => (
              <option key={e.id} value={String(e.id)}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl sm:rounded-3xl border border-outline-variant/10 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[720px]">
            <thead>
              <tr className="bg-surface-container-highest/30">
                <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                  المعرّف
                </th>
                <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                  الاسم
                </th>
                <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                  البريد
                </th>
                <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                  المناسبة
                </th>
                <th className="px-4 sm:px-6 py-4 text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest border-b border-outline-variant/10">
                  الدور
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/5">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-on-surface-variant text-sm">
                    {team.length === 0
                      ? "لا يوجد منظمين أو منسقين مسجّلين على مناسبات منصتك"
                      : "لا توجد نتائج مطابقة للفلاتر"}
                  </td>
                </tr>
              ) : (
                filtered.map((member) => (
                  <tr
                    key={`${member.id}-${member.event_id}-${member.role_key}`}
                    className="hover:bg-surface-container-high/30 transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4 text-sm font-mono text-on-surface-variant tabular-nums">
                      {member.id}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-primary-container/15 flex items-center justify-center text-primary font-bold shrink-0">
                          {member.avatar_initial}
                        </div>
                        <span className="font-bold text-on-surface text-sm truncate">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-on-surface-variant" dir="ltr">
                      {member.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm">
                      <Link
                        href={`/event-manager/events/${member.event_id}`}
                        className="font-bold text-primary hover:underline line-clamp-2"
                      >
                        {member.event_title}
                      </Link>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      <span
                        className={`inline-flex px-3 py-1 rounded-full text-[11px] font-bold ${
                          member.role_key === "coordinator"
                            ? "bg-tertiary/15 text-tertiary border border-tertiary/25"
                            : "bg-primary-container/15 text-primary border border-primary/25"
                        }`}
                      >
                        {member.role_label}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 sm:px-6 py-3 border-t border-outline-variant/10 text-xs text-on-surface-variant">
          عرض {filtered.length} من {team.length}
        </div>
      </div>
    </div>
  );
}
