"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  staticPagesAPI,
  type StaticPage,
  type StaticPagesOverview,
  type StaticPageTypeOption,
  type StaticPageWritePayload,
} from "@/lib/api";

type ModalMode = "create" | "edit" | "delete" | null;
type EditorTab = "edit" | "preview";

const emptyOverview: StaticPagesOverview = {
  stats: { total: 0, published: 0, draft: 0, in_footer: 0, on_landing: 0, by_type: {} },
  page_types: [],
};

function normalizeList(data: unknown): StaticPage[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: StaticPage[] }).results ?? [];
  }
  return [];
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
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

const emptyForm: StaticPageWritePayload = {
  slug: "",
  page_type: "custom",
  title: "",
  subtitle: "",
  content: "",
  meta_title: "",
  meta_description: "",
  icon: "article",
  is_published: false,
  show_in_footer: true,
  show_in_header: false,
  show_on_landing: true,
  sort_order: 0,
};

export default function StaticPagesView() {
  const [overview, setOverview] = useState<StaticPagesOverview>(emptyOverview);
  const [items, setItems] = useState<StaticPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "published" | "draft">("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<StaticPage | null>(null);
  const [form, setForm] = useState<StaticPageWritePayload>({ ...emptyForm });
  const [editorTab, setEditorTab] = useState<EditorTab>("edit");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const pageTypes = overview.page_types;

  const selectedTypeMeta = useMemo(
    () => pageTypes.find((t) => t.value === form.page_type),
    [pageTypes, form.page_type]
  );

  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (typeFilter) params.page_type = typeFilter;
      if (statusFilter === "published") params.is_published = "true";
      if (statusFilter === "draft") params.is_published = "false";
      if (search.trim()) params.search = search.trim();

      const [overviewRes, listRes] = await Promise.all([
        staticPagesAPI.overview(),
        staticPagesAPI.list(params),
      ]);
      setOverview(overviewRes.data);
      setItems(normalizeList(listRes.data));
    } catch {
      setOverview(emptyOverview);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = (type?: StaticPageTypeOption) => {
    const t = type ?? pageTypes.find((x) => x.value === "custom");
    setForm({
      ...emptyForm,
      page_type: t?.value ?? "custom",
      slug: t?.slug !== "custom" ? t?.slug ?? "" : "",
      title: t?.label ?? "",
      icon: t?.icon ?? "article",
      sort_order: items.length,
    });
    setSelected(null);
    setFormError("");
    setEditorTab("edit");
    setModalMode("create");
  };

  const openEdit = (item: StaticPage) => {
    setSelected(item);
    setForm({
      slug: item.slug,
      page_type: item.page_type,
      title: item.title,
      subtitle: item.subtitle,
      content: item.content,
      meta_title: item.meta_title,
      meta_description: item.meta_description,
      icon: item.icon,
      is_published: item.is_published,
      show_in_footer: item.show_in_footer,
      show_in_header: item.show_in_header,
      show_on_landing: item.show_on_landing,
      sort_order: item.sort_order,
    });
    setFormError("");
    setEditorTab("edit");
    setModalMode("edit");
  };

  const openDelete = (item: StaticPage) => {
    setSelected(item);
    setFormError("");
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setFormError("");
  };

  const handleTypeChange = (value: string) => {
    const meta = pageTypes.find((t) => t.value === value);
    setForm((f) => ({
      ...f,
      page_type: value,
      slug: meta && meta.slug !== "custom" ? meta.slug : f.slug,
      title: f.title || meta?.label || f.title,
      icon: meta?.icon ?? f.icon,
    }));
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      setFormError("يرجى إدخال عنوان الصفحة");
      return;
    }
    if (!form.content.trim()) {
      setFormError("يرجى إدخال محتوى الصفحة");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload: StaticPageWritePayload = {
        ...form,
        title: form.title.trim(),
        content: form.content.trim(),
        subtitle: form.subtitle?.trim() ?? "",
      };
      if (modalMode === "create") {
        await staticPagesAPI.create(payload);
      } else if (selected) {
        await staticPagesAPI.update(selected.id, payload);
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
        setFormError("فشل حفظ الصفحة");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await staticPagesAPI.delete(selected.id);
      closeModal();
      await load();
    } catch {
      setFormError("فشل حذف الصفحة");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: number, publish: boolean) => {
    setActionId(id);
    try {
      if (publish) await staticPagesAPI.publish(id);
      else await staticPagesAPI.unpublish(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleSeedTemplate = async (pageType: string) => {
    setSeeding(true);
    try {
      await staticPagesAPI.seedTemplate(pageType);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedAll = async () => {
    setSeeding(true);
    try {
      await staticPagesAPI.seedDefaults();
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const movePage = async (id: number, direction: "up" | "down") => {
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;
    const a = items[idx];
    const b = items[swapIdx];
    setActionId(id);
    try {
      await staticPagesAPI.reorder([
        { id: a.id, sort_order: b.sort_order },
        { id: b.id, sort_order: a.sort_order },
      ]);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const stats = overview.stats;

  const kpiCards = [
    { label: "إجمالي الصفحات", value: stats.total, icon: "article" },
    { label: "منشورة", value: stats.published, icon: "visibility" },
    { label: "مسودة", value: stats.draft, icon: "edit_note" },
    { label: "في التذييل", value: stats.in_footer, icon: "web_asset" },
    { label: "صفحة الهبوط", value: stats.on_landing, icon: "home" },
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20 shadow-lg shadow-primary-container/20">
            <span
              className="material-symbols-outlined text-primary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              article
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              الصفحات الثابتة
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
              إدارة من نحن، سياسة الخصوصية، شروط الاستخدام، وصفحات صفحة الهبوط للزوار
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedAll}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 bg-surface-container-low hover:bg-surface-container-high transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">auto_fix_high</span>
            {seeding ? "جاري التحميل..." : "تحميل القوالب الافتراضية"}
          </button>
          <a
            href="/landing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 bg-primary-container/10 text-primary hover:bg-primary-container/20"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            معاينة الهبوط
          </a>
          <button
            type="button"
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary-container/25"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            إضافة صفحة
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
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

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
        <h3 className="text-sm font-bold text-on-surface mb-3">قوالب جاهزة للمنصات</h3>
        <div className="flex flex-wrap gap-2">
          {pageTypes
            .filter((t) => t.has_template)
            .map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={seeding}
                onClick={() => handleSeedTemplate(t.value)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 bg-surface-container/50 hover:border-primary-container/40 hover:bg-primary-container/10 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base" style={{ color: t.color }}>
                  {t.icon}
                </span>
                <span className="text-on-surface-variant">{t.label}</span>
              </button>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface sm:text-xl">قائمة الصفحات</h3>
            <p className="text-sm text-on-surface-variant">{items.length} صفحة</p>
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
                placeholder="بحث في الصفحات..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field sm:w-44"
            >
              <option value="">كل الأنواع</option>
              {pageTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "published" | "draft")}
              className="input-field sm:w-36"
            >
              <option value="">كل الحالات</option>
              <option value="published">منشورة</option>
              <option value="draft">مسودة</option>
            </select>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">description</span>
            <p className="text-on-surface-variant mb-4">لا توجد صفحات — ابدأ بتحميل القوالب الافتراضية</p>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedAll}
              className="text-sm font-bold text-primary"
            >
              تحميل القوالب الافتراضية
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <article
                key={item.id}
                className={`rounded-xl border p-4 sm:p-5 transition-all ${
                  item.is_published
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-outline-variant/10 bg-surface-container/30"
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
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
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.is_published
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                          }`}
                        >
                          {item.is_published ? "منشورة" : "مسودة"}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-sm text-on-surface-variant mb-2">{item.subtitle}</p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[10px]">
                        <span className="px-2 py-0.5 rounded-full border border-outline-variant/25 text-outline">
                          {item.page_type_label}
                        </span>
                        <span className="px-2 py-0.5 rounded-full border border-outline-variant/25 text-outline font-mono" dir="ltr">
                          /pages/{item.slug}
                        </span>
                        {item.show_in_footer && (
                          <span className="px-2 py-0.5 rounded-full border border-primary-container/25 text-primary">
                            تذييل
                          </span>
                        )}
                        {item.show_on_landing && (
                          <span className="px-2 py-0.5 rounded-full border border-primary-container/25 text-primary">
                            هبوط
                          </span>
                        )}
                        <span className="text-outline">{item.word_count} كلمة</span>
                      </div>
                      <p className="text-[10px] text-outline mt-2">
                        آخر تحديث: {formatDateTime(item.updated_at)}
                        {item.published_at && ` • نُشرت: ${formatDateTime(item.published_at)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0 || actionId === item.id}
                      onClick={() => movePage(item.id, "up")}
                      className="p-2 rounded-lg hover:bg-surface-container-high text-outline disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-lg">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1 || actionId === item.id}
                      onClick={() => movePage(item.id, "down")}
                      className="p-2 rounded-lg hover:bg-surface-container-high text-outline disabled:opacity-30"
                    >
                      <span className="material-symbols-outlined text-lg">arrow_downward</span>
                    </button>
                    {item.is_published && (
                      <a
                        href={item.public_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-primary-container/15 text-primary"
                        title="معاينة للزوار"
                      >
                        <span className="material-symbols-outlined text-lg">open_in_new</span>
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => handlePublish(item.id, !item.is_published)}
                      className="p-2 rounded-lg hover:bg-emerald-500/15 text-emerald-400 disabled:opacity-50"
                      title={item.is_published ? "إلغاء النشر" : "نشر"}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {item.is_published ? "visibility_off" : "publish"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="p-2 rounded-lg hover:bg-primary-container/15 text-primary"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(item)}
                      className="p-2 rounded-lg hover:bg-red-500/15 text-red-400"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl">
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
                    {modalMode === "create" ? "إضافة صفحة ثابتة" : "تعديل الصفحة"}
                  </h2>
                  <p className="text-xs text-on-surface-variant">المحتوى يظهر للزوار في صفحة الهبوط والروابط العامة</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="p-2 rounded-lg hover:bg-surface-container-high text-outline">
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
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">نوع الصفحة</label>
                  <select
                    value={form.page_type ?? "custom"}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="input-field w-full"
                    disabled={modalMode === "edit" && form.page_type !== "custom"}
                  >
                    {pageTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">المعرّف (Slug)</label>
                  <input
                    value={form.slug ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                    className="input-field w-full font-mono text-sm"
                    dir="ltr"
                    disabled={form.page_type !== "custom"}
                    placeholder="about-us"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">العنوان</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">العنوان الفرعي</label>
                  <input
                    value={form.subtitle ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-outline-variant/10 overflow-hidden">
                <div className="flex border-b border-outline-variant/10">
                  <button
                    type="button"
                    onClick={() => setEditorTab("edit")}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                      editorTab === "edit"
                        ? "bg-primary-container/15 text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    تحرير المحتوى
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab("preview")}
                    className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                      editorTab === "preview"
                        ? "bg-primary-container/15 text-primary"
                        : "text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    معاينة
                  </button>
                </div>
                {editorTab === "edit" ? (
                  <div className="p-4">
                    <textarea
                      value={form.content}
                      onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                      className="input-field w-full min-h-[280px] resize-y font-mono text-sm leading-relaxed"
                      placeholder="يمكنك استخدام HTML: <p>، <h3>، <ul>..."
                      dir="auto"
                    />
                    <p className="text-[10px] text-outline mt-2">
                      يدعم HTML الأساسي للتنسيق. استخدم العناوين والقوائم لتنظيم المحتوى.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 sm:p-6 prose prose-invert max-w-none static-page-content">
                    <h2 className="text-xl font-bold text-on-surface mb-2">{form.title}</h2>
                    {form.subtitle && (
                      <p className="text-on-surface-variant mb-4">{form.subtitle}</p>
                    )}
                    <div
                      className="text-on-surface-variant leading-relaxed space-y-3 [&_h3]:text-on-surface [&_h3]:font-bold [&_ul]:list-disc [&_ul]:pr-5"
                      dangerouslySetInnerHTML={{ __html: form.content || "<p class='text-outline'>لا يوجد محتوى</p>" }}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">عنوان SEO</label>
                  <input
                    value={form.meta_title ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">وصف SEO</label>
                  <input
                    value={form.meta_description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
                    className="input-field w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">ترتيب العرض</label>
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
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_published ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))}
                  />
                  منشورة
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.show_in_footer ?? true}
                    onChange={(e) => setForm((f) => ({ ...f, show_in_footer: e.target.checked }))}
                  />
                  عرض في التذييل
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.show_on_landing ?? true}
                    onChange={(e) => setForm((f) => ({ ...f, show_on_landing: e.target.checked }))}
                  />
                  عرض في صفحة الهبوط
                </label>
                <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.show_in_header ?? false}
                    onChange={(e) => setForm((f) => ({ ...f, show_in_header: e.target.checked }))}
                  />
                  عرض في الرأس
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-3 p-4 sm:p-6 border-t border-outline-variant/10 bg-surface-container-low">
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
                onClick={handleSubmit}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 disabled:opacity-50"
              >
                {submitting ? "جاري الحفظ..." : modalMode === "create" ? "إضافة الصفحة" : "حفظ التغييرات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-on-surface mb-2">حذف الصفحة</h2>
            <p className="text-sm text-on-surface-variant mb-6">
              هل تريد حذف <strong className="text-on-surface">{selected.title}</strong>؟
            </p>
            {formError && <p className="text-sm text-red-400 mb-4">{formError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30 text-on-surface-variant">
                إلغاء
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-red-500/90 text-white disabled:opacity-50"
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
