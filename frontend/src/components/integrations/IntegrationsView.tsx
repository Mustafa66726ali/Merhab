"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  integrationsAPI,
  type IntegrationCredential,
  type IntegrationOverview,
  type IntegrationProviderOption,
  type IntegrationWritePayload,
} from "@/lib/api";

type ModalMode = "create" | "edit" | "delete" | null;

const emptyOverview: IntegrationOverview = {
  stats: {
    total: 0,
    active: 0,
    inactive: 0,
    tested_ok: 0,
    test_failed: 0,
    never_tested: 0,
    by_category: {},
  },
  providers: [],
  categories: [],
};

function normalizeList(data: unknown): IntegrationCredential[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return (data as { results: IntegrationCredential[] }).results ?? [];
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

const emptyForm: IntegrationWritePayload = {
  provider: "email_smtp",
  category: "email",
  name: "",
  description: "",
  environment: "production",
  is_active: true,
  is_primary: false,
  api_key: "",
  api_secret: "",
  access_token: "",
  refresh_token: "",
  phone_number_id: "",
  business_account_id: "",
  from_email: "",
  from_name: "مرحّاب",
  smtp_host: "",
  smtp_port: 587,
  smtp_use_tls: true,
  webhook_url: "",
  webhook_secret: "",
  config: {},
  notes: "",
};

export default function IntegrationsView() {
  const [overview, setOverview] = useState<IntegrationOverview>(emptyOverview);
  const [items, setItems] = useState<IntegrationCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [envFilter, setEnvFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<IntegrationCredential | null>(null);
  const [form, setForm] = useState<IntegrationWritePayload>({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const providerCatalog = overview.providers;

  const selectedProviderMeta = useMemo(
    () => providerCatalog.find((p) => p.value === form.provider),
    [providerCatalog, form.provider]
  );

  const load = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { page_size: 500 };
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter === "active") params.is_active = "true";
      if (statusFilter === "inactive") params.is_active = "false";
      if (envFilter) params.environment = envFilter;
      if (search.trim()) params.search = search.trim();

      const [overviewRes, listRes] = await Promise.all([
        integrationsAPI.overview(),
        integrationsAPI.list(params),
      ]);
      setOverview(overviewRes.data);
      setItems(normalizeList(listRes.data));
    } catch {
      setOverview(emptyOverview);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, envFilter, search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const openCreate = (provider?: IntegrationProviderOption) => {
    const p = provider ?? providerCatalog.find((x) => x.value === "email_smtp");
    setForm({
      ...emptyForm,
      provider: p?.value ?? "email_smtp",
      category: p?.category ?? "email",
      name: p ? `تكامل ${p.label}` : "",
    });
    setSelected(null);
    setFormError("");
    setModalMode("create");
  };

  const openEdit = (item: IntegrationCredential) => {
    setSelected(item);
    setForm({
      provider: item.provider,
      category: item.category,
      name: item.name,
      description: item.description,
      environment: item.environment,
      is_active: item.is_active,
      is_primary: item.is_primary,
      api_key: "",
      api_secret: "",
      access_token: "",
      refresh_token: "",
      phone_number_id: item.phone_number_id,
      business_account_id: item.business_account_id,
      from_email: item.from_email,
      from_name: item.from_name,
      smtp_host: item.smtp_host,
      smtp_port: item.smtp_port,
      smtp_use_tls: item.smtp_use_tls,
      webhook_url: item.webhook_url,
      webhook_secret: "",
      config: item.config ?? {},
      notes: item.notes,
    });
    setFormError("");
    setModalMode("edit");
  };

  const openDelete = (item: IntegrationCredential) => {
    setSelected(item);
    setFormError("");
    setModalMode("delete");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setFormError("");
  };

  const handleProviderChange = (value: string) => {
    const meta = providerCatalog.find((p) => p.value === value);
    setForm((f) => ({
      ...f,
      provider: value,
      category: meta?.category ?? f.category,
      name: f.name || (meta ? `تكامل ${meta.label}` : f.name),
    }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setFormError("يرجى إدخال اسم التكامل");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const payload: IntegrationWritePayload = { ...form, name: form.name.trim() };
      if (modalMode === "create") {
        await integrationsAPI.create(payload);
      } else if (selected) {
        await integrationsAPI.update(selected.id, payload);
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
        setFormError("فشل حفظ التكامل");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await integrationsAPI.delete(selected.id);
      closeModal();
      await load();
    } catch {
      setFormError("فشل حذف التكامل");
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async (id: number) => {
    setActionId(id);
    try {
      await integrationsAPI.test(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleToggle = async (id: number) => {
    setActionId(id);
    try {
      await integrationsAPI.toggle(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const handleSetPrimary = async (id: number) => {
    setActionId(id);
    try {
      await integrationsAPI.setPrimary(id);
      await load();
    } finally {
      setActionId(null);
    }
  };

  const stats = overview.stats;

  const kpiCards = [
    { label: "إجمالي التكاملات", value: stats.total, icon: "extension", accent: "primary" },
    { label: "نشط", value: stats.active, icon: "check_circle", accent: "emerald" },
    { label: "معطّل", value: stats.inactive, icon: "pause_circle", accent: "amber" },
    { label: "اختبار ناجح", value: stats.tested_ok, icon: "verified", accent: "emerald" },
    { label: "اختبار فاشل", value: stats.test_failed, icon: "error", accent: "red" },
    { label: "لم يُختبر", value: stats.never_tested, icon: "help", accent: "outline" },
  ];

  const statusBadge = (item: IntegrationCredential) => {
    if (!item.is_active) {
      return "bg-amber-500/10 text-amber-400 border-amber-500/25";
    }
    if (item.last_test_status === "success") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/25";
    }
    if (item.last_test_status === "failed") {
      return "bg-red-500/10 text-red-400 border-red-500/25";
    }
    return "bg-primary-container/10 text-primary border-primary-container/25";
  };

  const statusLabel = (item: IntegrationCredential) => {
    if (!item.is_active) return "معطّل";
    return item.last_test_status_label || "نشط";
  };

  const showField = (field: string) => {
    if (!selectedProviderMeta) return true;
    return selectedProviderMeta.fields.includes(field);
  };

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
              extension
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
              التكاملات الخارجية
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
              إدارة مفاتيح API والتوكنات للواتساب، البريد الإلكتروني، الدفع، والخدمات الخارجية
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container hover:brightness-110 shadow-lg shadow-primary-container/25 transition-all self-start"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          إضافة تكامل
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

      {/* Quick add by provider */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
        <h3 className="text-sm font-bold text-on-surface mb-3">إضافة سريعة حسب المزود</h3>
        <div className="flex flex-wrap gap-2">
          {providerCatalog.slice(0, 8).map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => openCreate(p)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/20 bg-surface-container/50 hover:border-primary-container/40 hover:bg-primary-container/10 transition-all"
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ color: p.color }}
              >
                {p.icon}
              </span>
              <span className="text-on-surface-variant">{p.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Category overview */}
      {overview.categories.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {overview.categories.map((cat) => {
            const catStats = stats.by_category[cat.value];
            const count = catStats?.count ?? 0;
            const isActive = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategoryFilter(isActive ? "" : cat.value)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  isActive
                    ? "border-primary-container/50 bg-primary-container/15 shadow-sm shadow-primary-container/10"
                    : "border-outline-variant/10 bg-surface-container-low hover:border-primary-container/25"
                }`}
              >
                <p className="text-[10px] text-on-surface-variant font-bold truncate">{cat.label}</p>
                <p className="text-lg font-extrabold text-on-surface tabular-nums">{count}</p>
                {catStats && (
                  <p className="text-[10px] text-emerald-400">{catStats.active} نشط</p>
                )}
              </button>
            );
          })}
        </section>
      )}

      {/* Main list */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-bold text-on-surface sm:text-xl">مفاتيح API والتوكنات</h3>
            <p className="text-sm text-on-surface-variant">{items.length} تكامل</p>
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
                placeholder="بحث في التكاملات..."
                className="input-field pr-10 w-full"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "inactive")}
              className="input-field sm:w-36"
            >
              <option value="">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="inactive">معطّل</option>
            </select>
            <select
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              className="input-field sm:w-36"
            >
              <option value="">كل البيئات</option>
              <option value="production">إنتاج</option>
              <option value="sandbox">تجريبي</option>
            </select>
            {(categoryFilter || statusFilter || envFilter || search) && (
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("");
                  setStatusFilter("");
                  setEnvFilter("");
                  setSearch("");
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">link_off</span>
            <p className="text-on-surface-variant mb-4">لا توجد تكاملات مطابقة</p>
            <button
              type="button"
              onClick={() => openCreate()}
              className="text-sm font-bold text-primary hover:text-primary-fixed-dim"
            >
              إضافة أول تكامل
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((item) => (
              <article
                key={item.id}
                className={`rounded-2xl border p-4 sm:p-5 transition-all hover:border-primary-container/30 ${
                  item.is_primary
                    ? "border-primary-container/40 bg-primary-container/5 shadow-sm shadow-primary-container/10"
                    : "border-outline-variant/10 bg-surface-container/30"
                }`}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: item.color }}
                    >
                      {item.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold text-on-surface text-sm truncate">{item.name}</h4>
                      {item.is_primary && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-container/20 text-primary border border-primary-container/30">
                          أساسي
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant">{item.provider_label}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge(item)}`}
                      >
                        {statusLabel(item)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/25 text-outline">
                        {item.environment_label}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/25 text-outline">
                        {item.category_label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-xs">
                  {item.has_api_key && (
                    <div className="flex justify-between gap-2">
                      <span className="text-outline">مفتاح API</span>
                      <span className="font-mono text-on-surface-variant truncate max-w-[60%]">
                        {item.api_key_masked}
                      </span>
                    </div>
                  )}
                  {item.from_email && (
                    <div className="flex justify-between gap-2">
                      <span className="text-outline">البريد المرسل</span>
                      <span className="text-on-surface-variant truncate max-w-[60%]" dir="ltr">
                        {item.from_email}
                      </span>
                    </div>
                  )}
                  {item.smtp_host && (
                    <div className="flex justify-between gap-2">
                      <span className="text-outline">SMTP</span>
                      <span className="text-on-surface-variant truncate max-w-[60%]" dir="ltr">
                        {item.smtp_host}:{item.smtp_port}
                      </span>
                    </div>
                  )}
                  {item.last_tested_at && (
                    <div className="flex justify-between gap-2">
                      <span className="text-outline">آخر اختبار</span>
                      <span className="text-on-surface-variant">{formatDateTime(item.last_tested_at)}</span>
                    </div>
                  )}
                  {item.last_test_error && (
                    <p className="text-red-400 text-[10px] leading-relaxed">{item.last_test_error}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1 pt-3 border-t border-outline-variant/10">
                  <button
                    type="button"
                    disabled={actionId === item.id}
                    onClick={() => handleTest(item.id)}
                    className="p-2 rounded-lg hover:bg-primary-container/15 text-primary transition-colors disabled:opacity-50"
                    title="اختبار الاتصال"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {actionId === item.id ? "progress_activity" : "bolt"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={actionId === item.id}
                    onClick={() => handleToggle(item.id)}
                    className="p-2 rounded-lg hover:bg-amber-500/15 text-amber-400 transition-colors disabled:opacity-50"
                    title={item.is_active ? "تعطيل" : "تفعيل"}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {item.is_active ? "pause" : "play_arrow"}
                    </span>
                  </button>
                  {!item.is_primary && (
                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => handleSetPrimary(item.id)}
                      className="p-2 rounded-lg hover:bg-emerald-500/15 text-emerald-400 transition-colors disabled:opacity-50"
                      title="تعيين كأساسي"
                    >
                      <span className="material-symbols-outlined text-lg">star</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="p-2 rounded-lg hover:bg-primary-container/15 text-primary transition-colors"
                    title="تعديل"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openDelete(item)}
                    className="p-2 rounded-lg hover:bg-red-500/15 text-red-400 transition-colors"
                    title="حذف"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Security notice */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-5 flex gap-3">
        <span className="material-symbols-outlined text-primary shrink-0">security</span>
        <div className="text-xs text-on-surface-variant leading-relaxed space-y-1">
          <p className="font-bold text-on-surface text-sm">أمان المفاتيح</p>
          <p>
            تُخزَّن المفاتيح بشكل آمن ولا تُعرض كاملة في الواجهة. استخدم بيئة تجريبية للاختبار قبل
            الإنتاج. لا تشارك مفاتيح API في الرسائل أو المستندات العامة.
          </p>
        </div>
      </section>

      {/* Create / Edit Modal */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-6 border-b border-outline-variant/10 bg-surface-container-low">
              <div>
                <h2 className="text-lg font-bold text-on-surface">
                  {modalMode === "create" ? "إضافة تكامل خارجي" : "تعديل التكامل"}
                </h2>
                {selectedProviderMeta?.help && (
                  <p className="text-xs text-on-surface-variant mt-1">{selectedProviderMeta.help}</p>
                )}
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
                    المزود
                  </label>
                  <select
                    value={form.provider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="input-field w-full"
                    disabled={modalMode === "edit"}
                  >
                    {providerCatalog.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    اسم التكامل
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="input-field w-full"
                    placeholder="مثال: بريد استعادة كلمة المرور"
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
                    placeholder="وصف مختصر لاستخدام هذا التكامل..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">
                    البيئة
                  </label>
                  <select
                    value={form.environment ?? "production"}
                    onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                    className="input-field w-full"
                  >
                    <option value="production">إنتاج</option>
                    <option value="sandbox">تجريبي</option>
                  </select>
                </div>

                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active ?? true}
                      onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                      className="rounded border-outline-variant/50"
                    />
                    نشط
                  </label>
                  <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_primary ?? false}
                      onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
                      className="rounded border-outline-variant/50"
                    />
                    أساسي للفئة
                  </label>
                </div>
              </div>

              {/* Credential fields */}
              <div className="rounded-xl border border-outline-variant/10 p-4 space-y-4">
                <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">key</span>
                  بيانات الاعتماد
                </h4>

                {showField("api_key") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      {form.provider === "email_smtp" ? "كلمة مرور SMTP / API Key" : "مفتاح API"}
                      {modalMode === "edit" && (
                        <span className="text-outline"> (اتركه فارغاً للإبقاء على القيمة الحالية)</span>
                      )}
                    </label>
                    <input
                      type="password"
                      value={form.api_key ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {showField("api_secret") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      سر API / Auth Token
                    </label>
                    <input
                      type="password"
                      value={form.api_secret ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, api_secret: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {showField("access_token") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      رمز الوصول (Access Token)
                    </label>
                    <input
                      type="password"
                      value={form.access_token ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, access_token: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {showField("phone_number_id") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      معرف رقم الهاتف / Phone Number ID
                    </label>
                    <input
                      value={form.phone_number_id ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, phone_number_id: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                    />
                  </div>
                )}

                {showField("business_account_id") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      معرف الحساب التجاري
                    </label>
                    <input
                      value={form.business_account_id ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, business_account_id: e.target.value }))
                      }
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                    />
                  </div>
                )}

                {showField("from_email") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        البريد المرسل (From Email)
                      </label>
                      <input
                        type="email"
                        value={form.from_email ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                        className="input-field w-full"
                        dir="ltr"
                        placeholder="noreply@merhab.sa"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        اسم المرسل
                      </label>
                      <input
                        value={form.from_name ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                        className="input-field w-full"
                        placeholder="مرحّاب"
                      />
                    </div>
                  </div>
                )}

                {(showField("smtp_host") || form.provider === "email_smtp") && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        خادم SMTP
                      </label>
                      <input
                        value={form.smtp_host ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))}
                        className="input-field w-full font-mono text-sm"
                        dir="ltr"
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-on-surface-variant mb-2">
                        المنفذ
                      </label>
                      <input
                        type="number"
                        value={form.smtp_port ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            smtp_port: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                        className="input-field w-full"
                        dir="ltr"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-on-surface-variant sm:col-span-3">
                      <input
                        type="checkbox"
                        checked={form.smtp_use_tls ?? true}
                        onChange={(e) => setForm((f) => ({ ...f, smtp_use_tls: e.target.checked }))}
                      />
                      استخدام TLS/SSL
                    </label>
                  </div>
                )}

                {showField("webhook_url") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      رابط Webhook
                    </label>
                    <input
                      value={form.webhook_url ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, webhook_url: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                      placeholder="https://..."
                    />
                  </div>
                )}

                {showField("webhook_secret") && (
                  <div>
                    <label className="block text-xs font-medium text-on-surface-variant mb-2">
                      سر Webhook
                    </label>
                    <input
                      type="password"
                      value={form.webhook_secret ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, webhook_secret: e.target.value }))}
                      className="input-field w-full font-mono text-sm"
                      dir="ltr"
                      autoComplete="new-password"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-2">
                  ملاحظات داخلية
                </label>
                <textarea
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="input-field w-full min-h-[64px] resize-y"
                  placeholder="ملاحظات للفريق التقني..."
                />
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
                {submitting ? "جاري الحفظ..." : modalMode === "create" ? "إضافة التكامل" : "حفظ التغييرات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400">delete_forever</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-on-surface">حذف التكامل</h2>
                <p className="text-sm text-on-surface-variant">لا يمكن التراجع عن هذا الإجراء</p>
              </div>
            </div>
            <p className="text-sm text-on-surface-variant mb-6">
              هل تريد حذف تكامل <strong className="text-on-surface">{selected.name}</strong>؟ سيتم
              إزالة جميع المفاتيح المرتبطة.
            </p>
            {formError && (
              <p className="text-sm text-red-400 mb-4">{formError}</p>
            )}
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
