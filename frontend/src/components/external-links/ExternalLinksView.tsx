"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  externalLinksAPI,
  type ExternalLink,
  type ExternalLinksOverview,
  type ExternalLinkTypeOption,
  type ExternalLinkWritePayload,
} from "@/lib/api";

type ModalMode = "create" | "edit" | "delete" | null;

const emptyOverview: ExternalLinksOverview = {
  stats: {
    total: 0,
    active: 0,
    inactive: 0,
    featured: 0,
    system_wide: 0,
    platform_specific: 0,
    total_clicks: 0,
    by_category: {},
    by_placement: {},
  },
  link_types: [],
  categories: [],
  placements: [],
  platform_options: [],
};

function normalizeList(data: unknown): ExternalLink[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: ExternalLink[] }).results ?? [];
  }
  return [];
}

function formatDateTime(iso: string) {
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

const emptyForm: ExternalLinkWritePayload = {
  title: "",
  url: "",
  link_type: "website",
  category: "website",
  placement: "all",
  description: "",
  icon: "",
  platform: null,
  is_active: true,
  is_featured: false,
  open_in_new_tab: true,
  sort_order: 0,
};

export default function ExternalLinksView() {
  const [overview, setOverview] = useState<ExternalLinksOverview>(emptyOverview);
  const [items, setItems] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [placementFilter, setPlacementFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive" | "featured">("");
  const [platformFilter, setPlatformFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<ExternalLink | null>(null);
  const [form, setForm] = useState<ExternalLinkWritePayload>({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [urlValidation, setUrlValidation] = useState<{ valid: boolean; message: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const linkTypes = overview.link_types;

  const selectedTypeMeta = useMemo(
    () => linkTypes.find((t) => t.value === form.link_type),
    [linkTypes, form.link_type]
  );

  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (categoryFilter) params.category = categoryFilter;
      if (placementFilter) params.placement = placementFilter;
      if (statusFilter === "active") params.is_active = "true";
      if (statusFilter === "inactive") params.is_active = "false";
      if (statusFilter === "featured") params.is_featured = "true";
      if (platformFilter === "system") params.platform = "system";
      else if (platformFilter) params.platform = platformFilter;
      if (search.trim()) params.search = search.trim();

      const [overviewRes, listRes] = await Promise.all([
        externalLinksAPI.overview(),
        externalLinksAPI.list(params),
      ]);
      setOverview(overviewRes.data);
      setItems(normalizeList(listRes.data));
    } catch {
      setOverview(emptyOverview);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, placementFilter, statusFilter, platformFilter, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = (type?: ExternalLinkTypeOption) => {
    const t = type ?? linkTypes.find((x) => x.value === "website");
    setForm({
      ...emptyForm,
      link_type: t?.value ?? "website",
      category: t?.category ?? "website",
      title: t ? t.label : "",
      sort_order: items.length,
    });
    setSelected(null);
    setFormError("");
    setUrlValidation(null);
    setModalMode("create");
  };

  const openEdit = (item: ExternalLink) => {
    setSelected(item);
    setForm({
      title: item.title,
      url: item.url,
      link_type: item.link_type,
      category: item.category,
      placement: item.placement,
      description: item.description,
      icon: item.icon,
      platform: item.platform,
      is_active: item.is_active,
      is_featured: item.is_featured,
      open_in_new_tab: item.open_in_new_tab,
      sort_order: item.sort_order,
    });
    setFormError("");
    setUrlValidation({ valid: true, message: "الرابط صالح" });
    setModalMode("edit");
  };

  const openDelete = (item: ExternalLink) => {
    setSelected(item);
    setFormError("");
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setFormError("");
    setUrlValidation(null);
  };

  const handleTypeChange = (value: string) => {
    const meta = linkTypes.find((t) => t.value === value);
    setForm((f) => ({
      ...f,
      link_type: value,
      category: meta?.category ?? f.category,
      title: f.title || (meta?.label ?? f.title),
    }));
  };

  const validateUrlField = async (url: string) => {
    if (!url.trim()) {
      setUrlValidation(null);
      return;
    }
    try {
      const res = await externalLinksAPI.validateUrl(url.trim());
      setUrlValidation(res.data);
    } catch {
      setUrlValidation({ valid: false, message: "تعذر التحقق من الرابط" });
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setFormError("يرجى إدخال عنوان الرابط");
      return;
    }
    if (!form.url.trim()) {
      setFormError("يرجى إدخال الرابط");
      return;
    }
    if (urlValidation && !urlValidation.valid) {
      setFormError(urlValidation.message);
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload: ExternalLinkWritePayload = {
        ...form,
        title: form.title.trim(),
        url: form.url.trim(),
        platform: form.platform || null,
      };
      if (modalMode === "create") {
        await externalLinksAPI.create(payload);
      } else if (selected) {
        await externalLinksAPI.update(selected.id, payload);
      }
      closeModal();
      await load();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data;
      if (detail && typeof detail === "object") {
        const first = Object.values(detail)[0];
        setFormError(Array.isArray(first) ? first[0] : String(first));
      } else {
        setFormError("فشل حفظ الرابط");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await externalLinksAPI.delete(selected.id);
      closeModal();
      await load();
    } catch {
      setFormError("فشل حذف الرابط");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    setActionId(id);
    try {
      await externalLinksAPI.toggle(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleToggleFeatured = async (id: number) => {
    setActionId(id);
    try {
      await externalLinksAPI.toggleFeatured(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const moveLink = async (id: number, direction: "up" | "down") => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const newItems = [...items];
    const a = newItems[idx];
    const b = newItems[swapIdx];
    const reorderPayload = [
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ];
    setActionId(id);
    try {
      await externalLinksAPI.reorder(reorderPayload);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const stats = overview.stats;

  const kpiCards = [
    { label: "إجمالي الروابط", value: stats.total, icon: "link" },
    { label: "نشط", value: stats.active, icon: "check_circle" },
    { label: "مميز", value: stats.featured, icon: "star" },
    { label: "على مستوى النظام", value: stats.system_wide, icon: "dns" },
    { label: "خاص بمنصة", value: stats.platform_specific, icon: "hub" },
    { label: "إجمالي النقرات", value: stats.total_clicks, icon: "ads_click" },
  ];

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              link
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              الروابط الخارجية
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
              إدارة روابط التواصل الاجتماعي، المواقع، تطبيقات الجوال، والدعم المعروضة في النظام
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary-container/25 transition-all self-start"
        >
          <span className="material-symbols-outlined text-lg">add_link</span>
          إضافة رابط
        </button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 relative overflow-hidden hover:border-primary-container/20 transition-colors"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary-container/10 blur-[40px] rounded-full -mr-8 -mt-8" />
            <span className="material-symbols-outlined text-primary text-lg mb-2 block relative z-10">
              {card.icon}
            </span>
            <p className="text-[10px] font-bold text-on-surface-variant relative z-10">{card.label}</p>
            <p className="text-xl sm:text-2xl font-extrabold text-on-surface font-headline mt-1 tabular-nums relative z-10">
              {card.value.toLocaleString("ar-SA")}
            </p>
          </div>
        ))}
      </section>

      {/* Quick add */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
        <h3 className="text-sm font-bold text-on-surface mb-3">إضافة سريعة</h3>
        <div className="flex flex-wrap gap-2">
          {linkTypes.slice(0, 10).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => openCreate(t)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 bg-surface-container/50 hover:border-primary-container/40 hover:bg-primary-container/10 transition-all"
            >
              <span className="material-symbols-outlined text-base" style={{ color: t.color }}>
                {t.icon}
              </span>
              <span className="text-on-surface-variant">{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Category chips */}
      {overview.categories.length > 0 && (
        <section className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              !categoryFilter
                ? "border-primary-container/50 bg-primary-container/15 text-primary"
                : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
            }`}
          >
            كل الفئات
          </button>
          {overview.categories.map((cat) => {
            const catStats = stats.by_category[cat.value];
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() =>
                  setCategoryFilter(categoryFilter === cat.value ? "" : cat.value)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  categoryFilter === cat.value
                    ? "border-primary-container/50 bg-primary-container/15 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant hover:border-primary-container/30"
                }`}
              >
                {cat.label}
                {catStats ? ` (${catStats.count})` : ""}
              </button>
            );
          })}
        </section>
      )}

      {/* Main table / cards */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface sm:text-xl">قائمة الروابط</h3>
            <p className="text-sm text-on-surface-variant">{items.length} رابط</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:flex-wrap">
            <div className="relative flex-1 sm:min-w-[220px]">
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg">
                search
              </span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث في الروابط..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
              className="input-field sm:w-40"
            >
              <option value="">كل الأماكن</option>
              {overview.placements.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "" | "active" | "inactive" | "featured")
              }
              className="input-field sm:w-36"
            >
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطّل</option>
              <option value="featured">مميز</option>
            </select>
            <select
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
              className="input-field sm:w-44"
            >
              <option value="">كل النطاقات</option>
              <option value="system">النظام فقط</option>
              {overview.platform_options.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">link_off</span>
            <p className="text-on-surface-variant mb-4">لا توجد روابط مطابقة</p>
            <button
              type="button"
              onClick={() => openCreate()}
              className="text-sm font-bold text-primary hover:text-primary-fixed-dim"
            >
              إضافة أول رابط
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-on-surface-variant border-b border-outline-variant/10">
                    <th className="pb-3 pr-4 font-bold text-xs">#</th>
                    <th className="pb-3 pr-4 font-bold text-xs">الرابط</th>
                    <th className="pb-3 pr-4 font-bold text-xs">النوع</th>
                    <th className="pb-3 pr-4 font-bold text-xs">مكان العرض</th>
                    <th className="pb-3 pr-4 font-bold text-xs">النطاق</th>
                    <th className="pb-3 pr-4 font-bold text-xs">الحالة</th>
                    <th className="pb-3 pr-4 font-bold text-xs">نقرات</th>
                    <th className="pb-3 font-bold text-xs text-right">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-surface-container/40 transition-colors">
                      <td className="py-4 pr-4 text-outline tabular-nums">{item.sort_order}</td>
                      <td className="py-4 pr-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.display_color}20` }}
                          >
                            <span
                              className="material-symbols-outlined text-lg"
                              style={{ color: item.display_color }}
                            >
                              {item.display_icon}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-on-surface truncate">{item.title}</p>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline truncate block max-w-[280px]"
                              dir="ltr"
                            >
                              {item.domain || item.url}
                            </a>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-on-surface-variant text-xs">
                        {item.link_type_label}
                      </td>
                      <td className="py-4 pr-4 text-on-surface-variant text-xs">
                        {item.placement_label}
                      </td>
                      <td className="py-4 pr-4 text-on-surface-variant text-xs">
                        {item.platform_name || "النظام"}
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-1">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.is_active
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                            }`}
                          >
                            {item.is_active ? "نشط" : "معطّل"}
                          </span>
                          {item.is_featured && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-primary-container/10 text-primary border-primary-container/25">
                              مميز
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4 tabular-nums text-on-surface-variant">
                        {item.click_count.toLocaleString("ar-SA")}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            disabled={idx === 0 || actionId === item.id}
                            onClick={() => moveLink(item.id, "up")}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-outline disabled:opacity-30"
                            title="أعلى"
                          >
                            <span className="material-symbols-outlined text-base">arrow_upward</span>
                          </button>
                          <button
                            type="button"
                            disabled={idx === items.length - 1 || actionId === item.id}
                            onClick={() => moveLink(item.id, "down")}
                            className="p-1.5 rounded-lg hover:bg-surface-container-high text-outline disabled:opacity-30"
                            title="أسفل"
                          >
                            <span className="material-symbols-outlined text-base">arrow_downward</span>
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-primary-container/15 text-primary"
                            title="فتح"
                          >
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                          </a>
                          <button
                            type="button"
                            disabled={actionId === item.id}
                            onClick={() => handleToggleFeatured(item.id)}
                            className="p-1.5 rounded-lg hover:bg-primary-container/15 text-primary disabled:opacity-50"
                            title="مميز"
                          >
                            <span
                              className="material-symbols-outlined text-base"
                              style={
                                item.is_featured
                                  ? { fontVariationSettings: "'FILL' 1" }
                                  : undefined
                              }
                            >
                              star
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={actionId === item.id}
                            onClick={() => handleToggle(item.id)}
                            className="p-1.5 rounded-lg hover:bg-amber-500/15 text-amber-400 disabled:opacity-50"
                            title="تفعيل/تعطيل"
                          >
                            <span className="material-symbols-outlined text-base">
                              {item.is_active ? "pause" : "play_arrow"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg hover:bg-primary-container/15 text-primary"
                            title="تعديل"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete(item)}
                            className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400"
                            title="حذف"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden grid grid-cols-1 gap-4">
              {items.map((item, idx) => (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    item.is_featured
                      ? "border-primary-container/40 bg-primary-container/5"
                      : "border-outline-variant/10 bg-surface-container/30"
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${item.display_color}20` }}
                    >
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{ color: item.display_color }}
                      >
                        {item.display_icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-bold text-on-surface">{item.title}</h4>
                        {item.is_featured && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-container/20 text-primary border border-primary-container/30">
                            مميز
                          </span>
                        )}
                      </div>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary truncate block"
                        dir="ltr"
                      >
                        {item.url}
                      </a>
                      <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-outline">
                        <span>{item.link_type_label}</span>
                        <span>•</span>
                        <span>{item.placement_label}</span>
                        <span>•</span>
                        <span>{item.platform_name || "النظام"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
                    <span className="text-xs text-on-surface-variant tabular-nums">
                      {item.click_count.toLocaleString("ar-SA")} نقرة
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0 || actionId === item.id}
                        onClick={() => moveLink(item.id, "up")}
                        className="p-2 rounded-lg text-outline disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_upward</span>
                      </button>
                      <button
                        type="button"
                        disabled={idx === items.length - 1 || actionId === item.id}
                        onClick={() => moveLink(item.id, "down")}
                        className="p-2 rounded-lg text-outline disabled:opacity-30"
                      >
                        <span className="material-symbols-outlined text-lg">arrow_downward</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="p-2 rounded-lg text-primary"
                      >
                        <span className="material-symbols-outlined text-lg">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(item)}
                        className="p-2 rounded-lg text-red-400"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Preview strip */}
      {items.filter((i) => i.is_active).length > 0 && (
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
          <h3 className="text-sm font-bold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">preview</span>
            معاينة الروابط النشطة
          </h3>
          <div className="flex flex-wrap gap-3">
            {items
              .filter((i) => i.is_active)
              .slice(0, 12)
              .map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/15 bg-surface-container/50 hover:border-primary-container/40 hover:bg-primary-container/10 transition-all group"
                >
                  <span
                    className="material-symbols-outlined text-lg"
                    style={{ color: item.display_color }}
                  >
                    {item.display_icon}
                  </span>
                  <span className="text-sm font-bold text-on-surface-variant group-hover:text-primary">
                    {item.title}
                  </span>
                  <span className="material-symbols-outlined text-sm text-outline opacity-0 group-hover:opacity-100 transition-opacity">
                    open_in_new
                  </span>
                </a>
              ))}
          </div>
        </section>
      )}

      {/* Modal create/edit */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-outline-variant/10 bg-surface-container-low">
              <div className="flex items-center gap-3">
                {selectedTypeMeta && (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${selectedTypeMeta.color}20` }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: selectedTypeMeta.color }}
                    >
                      {selectedTypeMeta.icon}
                    </span>
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-on-surface">
                    {modalMode === "create" ? "إضافة رابط خارجي" : "تعديل الرابط"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">أدخل تفاصيل الرابط ومكان عرضه</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-surface-container-high text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {formError && (
                <div className="text-sm p-3 rounded-xl border border-red-500/25 bg-red-500/10 text-red-400">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    نوع الرابط
                  </label>
                  <select
                    value={form.link_type ?? "website"}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="input-field w-full"
                  >
                    {linkTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    عنوان الرابط
                  </label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="input-field w-full"
                    placeholder="مثال: حسابنا على Instagram"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    الرابط (URL)
                  </label>
                  <input
                    value={form.url}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, url: e.target.value }));
                      setUrlValidation(null);
                    }}
                    onBlur={(e) => validateUrlField(e.target.value)}
                    className="input-field w-full font-mono text-sm"
                    dir="ltr"
                    placeholder="https://..."
                  />
                  {urlValidation && (
                    <p
                      className={`text-xs mt-1 ${
                        urlValidation.valid ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {urlValidation.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    الفئة
                  </label>
                  <select
                    value={form.category ?? "website"}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    className="input-field w-full"
                  >
                    {overview.categories.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    مكان العرض
                  </label>
                  <select
                    value={form.placement ?? "all"}
                    onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}
                    className="input-field w-full"
                  >
                    {overview.placements.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    المنصة (اختياري)
                  </label>
                  <select
                    value={form.platform ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        platform: e.target.value ? Number(e.target.value) : null,
                      }))
                    }
                    className="input-field w-full"
                  >
                    <option value="">النظام (عام)</option>
                    {overview.platform_options.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    ترتيب العرض
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.sort_order ?? 0}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))
                    }
                    className="input-field w-full"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    الوصف
                  </label>
                  <textarea
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="input-field w-full min-h-[72px] resize-y"
                    placeholder="وصف مختصر للرابط..."
                  />
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                    />
                    نشط
                  </label>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_featured ?? false}
                      onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                    />
                    مميز
                  </label>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.open_in_new_tab ?? true}
                      onChange={(e) => setForm((f) => ({ ...f, open_in_new_tab: e.target.checked }))}
                    />
                    فتح في تبويب جديد
                  </label>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 p-4 sm:p-6 border-t border-outline-variant/10 bg-surface-container-low">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? "جاري الحفظ..." : modalMode === "create" ? "إضافة الرابط" : "حفظ التغييرات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400">delete_forever</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface">حذف الرابط</h2>
                <p className="text-sm text-on-surface-variant">لا يمكن التراجع عن هذا الإجراء</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              هل تريد حذف <strong className="text-on-surface">{selected.title}</strong>؟
            </p>
            {formError && <p className="text-sm text-red-400 mb-4">{formError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30 text-on-surface-variant"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500/90 text-white hover:bg-red-500 disabled:opacity-50"
              >
                {submitting ? "جاري الحذف..." : "حذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
