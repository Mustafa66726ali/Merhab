"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HighlightText } from "@/components/platforms/HighlightText";
import { platformsAPI, type Platform, type PlatformStats } from "@/lib/api";

type ModalMode = "delete" | null;

const emptyStats: PlatformStats = {
  total: 0,
  blocked: 0,
  most_active: null,
  least_active: null,
};

function normalizeList(data: unknown): Platform[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: Platform[] }).results ?? [];
  }
  return [];
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [stats, setStats] = useState<PlatformStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "blocked">("");
  const [dateFilter, setDateFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Platform | null>(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        platformsAPI.list({ page_size: 1000 }),
        platformsAPI.stats(),
      ]);
      setPlatforms(normalizeList(listRes.data));
      setStats(statsRes.data);
    } catch {
      setPlatforms([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return platforms.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (dateFilter && !p.created_at.startsWith(dateFilter)) return false;
      if (!q) return true;
      const hay = `${p.id} ${p.name} ${p.owner_name} ${p.owner_email}`.toLowerCase();
      return hay.includes(q);
    });
  }, [platforms, search, statusFilter, dateFilter]);

  const openDelete = (p: Platform) => {
    setSelected(p);
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setFormError("");
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await platformsAPI.delete(selected.id);
      closeModal();
      await loadData();
    } catch {
      setFormError("فشل حذف المنصة");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.created_date = dateFilter;
      if (search.trim()) params.search = search.trim();

      const res = await platformsAPI.export(params);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "platforms_export.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const statusBadge = (status: Platform["status"]) =>
    status === "active"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
      : "bg-red-500/10 text-red-400 border-red-500/25";

  const statusLabel = (status: Platform["status"]) =>
    status === "active" ? "نشطة" : "محظورة";

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">ادارة المنصات</h1>
          <p className="text-sm text-on-surface-variant mt-1">إدارة ومتابعة جميع المنصات على نظام مرحّاب</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            {exporting ? "جاري التصدير..." : "تصدير Excel"}
          </button>
          <Link
            href="/platforms/add"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary-container/25 transition-all"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            إضافة منصة
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-outline-variant/10 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary-container/10 blur-[50px] rounded-full -mr-10 -mt-10" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-on-surface-variant tracking-wider">اجمالي المنصات</span>
            <span className="material-symbols-outlined text-primary">dns</span>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-on-surface">{stats.total}</p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-outline-variant/10 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-on-surface-variant tracking-wider">المنصات المحظورة</span>
            <span className="material-symbols-outlined text-red-400">block</span>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-red-400">{stats.blocked}</p>
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-outline-variant/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-on-surface-variant tracking-wider">اكثر المنصات فعالية</span>
            <span className="material-symbols-outlined text-emerald-400">trending_up</span>
          </div>
          {stats.most_active ? (
            <>
              <p className="text-lg font-bold text-on-surface truncate">{stats.most_active.name}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {stats.most_active.events_count} فعالية · {stats.most_active.members_count} عضو
              </p>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">لا توجد بيانات</p>
          )}
        </div>

        <div className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-outline-variant/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-on-surface-variant tracking-wider">اقل المنصات فعالية</span>
            <span className="material-symbols-outlined text-tertiary">trending_down</span>
          </div>
          {stats.least_active ? (
            <>
              <p className="text-lg font-bold text-on-surface truncate">{stats.least_active.name}</p>
              <p className="text-xs text-on-surface-variant mt-1">
                {stats.least_active.events_count} فعالية · {stats.least_active.members_count} عضو
              </p>
            </>
          ) : (
            <p className="text-sm text-on-surface-variant">لا توجد بيانات</p>
          )}
        </div>
      </section>

      {/* Search & Filters */}
      <section className="bg-surface-container-low rounded-2xl p-4 sm:p-6 border border-outline-variant/10 space-y-4">
        <div className="relative">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث فوري في المنصات (الاسم، المالك، البريد، ID)..."
            className="input-field pr-11"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === ""
                  ? "bg-primary-container text-on-primary-container"
                  : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
              }`}
            >
              كل الحالات
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "active"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
              }`}
            >
              نشطة
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("blocked")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                statusFilter === "blocked"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
              }`}
            >
              محظورة
            </button>
          </div>

          <div className="flex items-center gap-2 sm:mr-auto">
            <label className="text-xs text-on-surface-variant shrink-0">تاريخ الإنشاء:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="input-field py-2 text-sm max-w-[180px]"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="p-2 text-outline hover:text-on-surface rounded-lg hover:bg-surface-container-high"
                title="مسح التاريخ"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-on-surface-variant">
          عرض <span className="text-primary font-bold">{filtered.length}</span> من{" "}
          <span className="font-bold">{platforms.length}</span> منصة
        </p>
      </section>

      {/* Table */}
      <section className="bg-surface-container-low rounded-2xl border border-outline-variant/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <span className="material-symbols-outlined text-5xl text-outline mb-4">dns</span>
            <p className="text-on-surface-variant">لا توجد منصات مطابقة للبحث أو الفلترة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="text-on-surface-variant text-xs font-bold border-b border-outline-variant/10 bg-surface-container/50">
                  <th className="py-4 px-4">ID</th>
                  <th className="py-4 px-4">اسم المنصة</th>
                  <th className="py-4 px-4">اسم المالك</th>
                  <th className="py-4 px-4 text-center">اجمالي الفعاليات</th>
                  <th className="py-4 px-4 text-center">اجمالي اعضاء المنصة</th>
                  <th className="py-4 px-4">الحالة</th>
                  <th className="py-4 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/5">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="py-4 px-4 text-sm font-mono text-on-surface-variant">
                      <HighlightText text={String(p.id)} query={search} />
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-bold text-sm text-on-surface">
                        <HighlightText text={p.name} query={search} />
                      </span>
                    </td>
                    <td className="py-4 px-4 text-sm text-on-surface-variant">
                      <HighlightText text={p.owner_name} query={search} />
                    </td>
                    <td className="py-4 px-4 text-center text-sm font-bold">{p.events_count}</td>
                    <td className="py-4 px-4 text-center text-sm font-bold">{p.members_count}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 text-[10px] font-bold rounded-full border ${statusBadge(p.status)}`}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/platforms/${p.id}`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary-container/10 transition-all"
                          title="عرض"
                        >
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </Link>
                        <Link
                          href={`/platforms/${p.id}/edit`}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-tertiary hover:bg-tertiary/10 transition-all"
                          title="تعديل"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => openDelete(p)}
                          className="p-2 rounded-lg text-on-surface-variant hover:text-red-400 hover:bg-red-400/10 transition-all"
                          title="حذف"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
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

      {/* Modal backdrop */}
      {modalMode && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-lg bg-surface-container border border-outline-variant/20 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Delete modal */}
            {modalMode === "delete" && selected && (
              <div className="p-6 sm:p-8">
                <div className="text-center">
                  <span className="material-symbols-outlined text-5xl text-red-400 mb-4">warning</span>
                  <h2 className="text-xl font-bold text-on-surface mb-2">حذف المنصة</h2>
                  <p className="text-sm text-on-surface-variant mb-6">
                    هل أنت متأكد من حذف منصة &quot;{selected.name}&quot;؟ لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  {formError && <p className="text-sm text-red-400 mb-4">{formError}</p>}
                  <div className="flex gap-3 justify-center">
                    <button type="button" onClick={closeModal} className="px-6 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30">
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-xl text-sm font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50"
                    >
                      {submitting ? "جاري الحذف..." : "تأكيد الحذف"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
