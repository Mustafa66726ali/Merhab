"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { activityLogsAPI, type ActivityLogItem, type ActivityLogsOverview } from "@/lib/api";

const emptyOverview: ActivityLogsOverview = {
  stats: { total: 0, today: 0, last_7_days: 0, failures_today: 0, success_rate: 100 },
  by_category: [],
  by_action: [],
  by_status: [],
  recent: [],
  filters: { actions: [], categories: [], statuses: [] },
};

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const statusStyles: Record<string, string> = {
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  failure: "bg-red-500/15 text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const actionIcons: Record<string, string> = {
  create: "add_circle",
  update: "edit",
  delete: "delete",
  login: "login",
  logout: "logout",
  view: "visibility",
  export: "download",
  publish: "public",
  approve: "check_circle",
  reject: "cancel",
  test: "science",
  system: "settings",
  other: "more_horiz",
};

function exportCsv(rows: ActivityLogItem[]) {
  const headers = ["التاريخ", "المستخدم", "الإجراء", "القسم", "الحالة", "الوصف", "IP", "المسار"];
  const lines = rows.map((r) =>
    [
      formatDateTime(r.created_at),
      r.user_email || r.user_name,
      r.action_label,
      r.category_label,
      r.status_label,
      r.description.replace(/"/g, "'"),
      r.ip_address || "",
      r.request_path,
    ]
      .map((c) => `"${c}"`)
      .join(",")
  );
  const blob = new Blob(["\uFEFF" + [headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ActivityLogsView() {
  const [overview, setOverview] = useState<ActivityLogsOverview>(emptyOverview);
  const [items, setItems] = useState<ActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<ActivityLogItem | null>(null);

  const pageSize = 25;

  const loadOverview = useCallback(async () => {
    try {
      const res = await activityLogsAPI.overview();
      setOverview(res.data);
    } catch {
      setOverview(emptyOverview);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, page_size: pageSize };
      if (search.trim()) params.search = search.trim();
      if (category) params.category = category;
      if (action) params.action = action;
      if (status) params.status = status;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await activityLogsAPI.list(params);
      setItems(res.data.results);
      setTotal(res.data.count);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, action, status, dateFrom, dateTo]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const maxCategoryCount = useMemo(
    () => Math.max(1, ...overview.by_category.map((c) => c.count)),
    [overview.by_category]
  );

  const resetFilters = () => {
    setSearch("");
    setCategory("");
    setAction("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-xl">history</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">سجلات النشاط</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              تدقيق وتتبع العمليات داخل النظام — المصادقة، التعديلات، والتصدير
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(items)}
          disabled={items.length === 0}
          className="px-4 py-2.5 rounded-xl text-xs font-bold border border-primary-container/30 text-primary bg-primary-container/10 flex items-center gap-2 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">download</span>
          تصدير CSV
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "إجمالي السجلات", value: overview.stats.total, icon: "inventory_2" },
          { label: "اليوم", value: overview.stats.today, icon: "today" },
          { label: "آخر 7 أيام", value: overview.stats.last_7_days, icon: "date_range" },
          { label: "فشل اليوم", value: overview.stats.failures_today, icon: "error" },
          { label: "نسبة النجاح", value: `${overview.stats.success_rate}%`, icon: "verified" },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-primary text-xl">{k.icon}</span>
            <div>
              <p className="text-[10px] sm:text-xs text-on-surface-variant">{k.label}</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-4">
        <div className="col-lg-4">
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 h-100">
            <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">category</span>
              حسب القسم (7 أيام)
            </h3>
            <div className="space-y-3">
              {overview.by_category.length === 0 ? (
                <p className="text-xs text-on-surface-variant">لا توجد بيانات</p>
              ) : (
                overview.by_category.slice(0, 8).map((c) => (
                  <div key={c.category}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-on-surface-variant">{c.label}</span>
                      <span className="font-bold tabular-nums">{c.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary-container transition-all"
                        style={{ width: `${(c.count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-8">
          <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5">
            <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">timeline</span>
              أحدث الأنشطة
            </h3>
            <div className="space-y-2 max-h-[220px] overflow-y-auto sidebar-scroll">
              {overview.recent.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setSelected(log)}
                  className="w-full text-right flex items-start gap-3 p-3 rounded-xl border border-outline-variant/10 hover:border-primary-container/30 hover:bg-primary-container/5 transition-all"
                >
                  <span className="material-symbols-outlined text-primary text-lg shrink-0 mt-0.5">
                    {actionIcons[log.action] || "history"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">{log.description}</p>
                    <p className="text-[10px] text-outline mt-0.5">
                      {log.user_email || log.user_name || "—"} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusStyles[log.status] || ""}`}
                  >
                    {log.status_label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 space-y-4">
        <div className="row g-3">
          <div className="col-md-6 col-lg-4">
            <input
              className="input-field"
              placeholder="بحث في السجلات..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="input-field text-sm"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الأقسام</option>
              {overview.filters.categories.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="input-field text-sm"
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الإجراءات</option>
              {overview.filters.actions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3 col-lg-2">
            <select
              className="input-field text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">كل الحالات</option>
              {overview.filters.statuses.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3 col-lg-2">
            <input
              type="date"
              className="input-field text-sm"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="col-6 col-md-3 col-lg-2">
            <input
              type="date"
              className="input-field text-sm"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetFilters}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-outline-variant/20 text-on-surface-variant hover:text-primary"
          >
            مسح الفلاتر
          </button>
          <span className="text-xs text-outline self-center">{total} سجل</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-outline/40 mb-3 block">history_toggle_off</span>
            <p className="text-sm">لا توجد سجلات مطابقة</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-outline-variant/10">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="bg-surface-container-high/80 text-on-surface-variant text-xs">
                    <th className="text-right p-3 font-bold">التاريخ</th>
                    <th className="text-right p-3 font-bold">المستخدم</th>
                    <th className="text-right p-3 font-bold">الإجراء</th>
                    <th className="text-right p-3 font-bold">القسم</th>
                    <th className="text-right p-3 font-bold">الحالة</th>
                    <th className="text-right p-3 font-bold">الوصف</th>
                    <th className="text-right p-3 font-bold w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((log) => (
                    <tr
                      key={log.id}
                      className="border-t border-outline-variant/10 hover:bg-primary-container/5 transition-colors"
                    >
                      <td className="p-3 text-xs text-on-surface-variant whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-on-surface text-xs truncate max-w-[140px]">
                          {log.user_name || log.user_email || "—"}
                        </p>
                        {log.user_role && (
                          <p className="text-[10px] text-outline">{log.user_role}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-xs font-bold">
                          <span className="material-symbols-outlined text-primary text-base">
                            {actionIcons[log.action] || "history"}
                          </span>
                          {log.action_label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-on-surface-variant">{log.category_label}</td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyles[log.status] || ""}`}
                        >
                          {log.status_label}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-on-surface-variant max-w-[200px] truncate">
                        {log.description}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setSelected(log)}
                          className="p-1.5 rounded-lg hover:bg-surface-container-high text-primary"
                          aria-label="تفاصيل"
                        >
                          <span className="material-symbols-outlined text-lg">info</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs text-on-surface-variant">
                صفحة {page} من {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 disabled:opacity-40"
                >
                  السابق
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto sidebar-scroll">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg">تفاصيل السجل</h3>
                <p className="text-xs text-on-surface-variant mt-1">{formatDateTime(selected.created_at)}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-outline-variant/10 p-3">
                <p className="text-[10px] text-outline mb-1">المستخدم</p>
                <p className="font-bold">{selected.user_name || selected.user_email || "—"}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/10 p-3">
                <p className="text-[10px] text-outline mb-1">الحالة</p>
                <p className="font-bold">{selected.status_label}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/10 p-3">
                <p className="text-[10px] text-outline mb-1">الإجراء</p>
                <p className="font-bold">{selected.action_label}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/10 p-3">
                <p className="text-[10px] text-outline mb-1">القسم</p>
                <p className="font-bold">{selected.category_label}</p>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-outline mb-1">الوصف</p>
              <p className="text-sm text-on-surface-variant leading-relaxed">{selected.description}</p>
            </div>

            {selected.object_repr && (
              <div>
                <p className="text-[10px] text-outline mb-1">العنصر</p>
                <p className="text-sm font-bold">{selected.object_repr}</p>
              </div>
            )}

            <div className="text-xs text-on-surface-variant space-y-1">
              {selected.ip_address && (
                <p className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">language</span>
                  IP: {selected.ip_address}
                </p>
              )}
              {selected.request_path && (
                <p className="flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                  <span className="material-symbols-outlined text-sm">link</span>
                  {selected.request_method} {selected.request_path}
                </p>
              )}
            </div>

            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div>
                <p className="text-[10px] text-outline mb-2">بيانات إضافية</p>
                <pre
                  className="text-[11px] p-3 rounded-xl bg-surface-container-high overflow-x-auto font-mono text-on-surface-variant"
                  dir="ltr"
                >
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
