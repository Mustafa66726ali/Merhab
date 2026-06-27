"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  publicMediaAPI,
  type LandingSiteConfig,
  type LandingStatItem,
  type LandingFeatureItem,
  type LandingTestimonial,
  type TestimonialSubmission,
} from "@/lib/api";

export default function LandingPageAdmin() {
  const [config, setConfig] = useState<LandingSiteConfig | null>(null);
  const [submissions, setSubmissions] = useState<TestimonialSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [configRes, subsRes] = await Promise.all([
        publicMediaAPI.getConfig(),
        publicMediaAPI.listTestimonials(),
      ]);
      setConfig(configRes.data);
      setSubmissions(subsRes.data);
    } catch {
      setConfig(null);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await publicMediaAPI.updateConfig(config);
      setConfig(res.data);
      setMessage("تم حفظ إعدادات صفحة الهبوط");
    } catch {
      setMessage("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    setSaving(true);
    try {
      const res = await publicMediaAPI.seed();
      setConfig(res.data);
      setMessage("تم تحميل الإعدادات الافتراضية");
    } finally {
      setSaving(false);
    }
  };

  const updateStat = (i: number, field: keyof LandingStatItem, value: string) => {
    if (!config) return;
    const stats = [...config.stats];
    stats[i] = { ...stats[i], [field]: value };
    setConfig({ ...config, stats });
  };

  const updateFeature = (i: number, field: keyof LandingFeatureItem, value: string) => {
    if (!config) return;
    const features = [...config.features];
    features[i] = { ...features[i], [field]: value };
    setConfig({ ...config, features });
  };

  const updateTestimonial = (i: number, field: keyof LandingTestimonial, value: string) => {
    if (!config) return;
    const testimonials = [...config.testimonials];
    testimonials[i] = { ...testimonials[i], [field]: value };
    setConfig({ ...config, testimonials });
  };

  const addTestimonial = () => {
    if (!config) return;
    setConfig({
      ...config,
      testimonials: [...config.testimonials, { name: "", role: "", text: "" }],
    });
  };

  const removeTestimonial = (i: number) => {
    if (!config) return;
    setConfig({
      ...config,
      testimonials: config.testimonials.filter((_, idx) => idx !== i),
    });
  };

  const reviewSubmission = async (
    id: number,
    patch: Partial<TestimonialSubmission>
  ) => {
    try {
      const res = await publicMediaAPI.updateTestimonial(id, patch);
      setSubmissions((prev) => prev.map((s) => (s.id === id ? res.data : s)));
    } catch {
      /* ignore */
    }
  };

  const promoteToConfig = (sub: TestimonialSubmission) => {
    if (!config) return;
    const exists = config.testimonials.some(
      (t) => t.text === sub.text && t.name === sub.name
    );
    if (exists) return;
    setConfig({
      ...config,
      testimonials: [
        ...config.testimonials,
        { name: sub.name, role: sub.role, text: sub.text },
      ],
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center py-20 text-on-surface-variant">
        تعذر تحميل الإعدادات
        <button type="button" onClick={seedDefaults} className="mt-4 text-primary font-bold text-sm">
          تحميل الافتراضي
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-xl">web</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">إعدادات صفحة الهبوط</h1>
            <p className="text-sm text-on-surface-variant mt-1">تخصيص النصوص والأقسام وآراء العملاء المعروضة للزوار</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/landing" target="_blank" className="px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 text-primary bg-primary-container/10 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">open_in_new</span>
            معاينة
          </Link>
          <Link href="/public-media" className="px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high">
            الوسائط
          </Link>
        </div>
      </div>

      {message && (
        <div className="text-sm p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">{message}</div>
      )}

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">title</span>
          قسم الهبوط الرئيسي
        </h3>
        <input className="input-field w-full" value={config.hero_title} onChange={(e) => setConfig({ ...config, hero_title: e.target.value })} placeholder="العنوان الرئيسي" />
        <input className="input-field w-full" value={config.hero_subtitle} onChange={(e) => setConfig({ ...config, hero_subtitle: e.target.value })} placeholder="العنوان الفرعي" />
        <textarea className="input-field w-full min-h-[80px]" value={config.hero_description} onChange={(e) => setConfig({ ...config, hero_description: e.target.value })} placeholder="الوصف" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input className="input-field" value={config.hero_cta_primary} onChange={(e) => setConfig({ ...config, hero_cta_primary: e.target.value })} placeholder="نص الزر الأساسي" />
          <input className="input-field font-mono text-sm" dir="ltr" value={config.hero_cta_primary_url} onChange={(e) => setConfig({ ...config, hero_cta_primary_url: e.target.value })} placeholder="/login" />
          <input className="input-field" value={config.hero_cta_secondary} onChange={(e) => setConfig({ ...config, hero_cta_secondary: e.target.value })} placeholder="نص الزر الثانوي" />
          <input className="input-field font-mono text-sm" dir="ltr" value={config.hero_cta_secondary_url} onChange={(e) => setConfig({ ...config, hero_cta_secondary_url: e.target.value })} placeholder="#about" />
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <input type="checkbox" checked={config.is_published ?? true} onChange={(e) => setConfig({ ...config, is_published: e.target.checked })} />
          صفحة الهبوط منشورة للزوار
        </label>
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-on-surface">أرقام وإحصائيات</h3>
        {config.stats.map((s, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <input className="input-field text-sm" value={s.label} onChange={(e) => updateStat(i, "label", e.target.value)} placeholder="التسمية" />
            <input className="input-field text-sm" value={s.value} onChange={(e) => updateStat(i, "value", e.target.value)} placeholder="القيمة" />
            <input className="input-field text-sm" value={s.icon} onChange={(e) => updateStat(i, "icon", e.target.value)} placeholder="أيقونة material" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-on-surface">المميزات</h3>
        {config.features.map((f, i) => (
          <div key={i} className="space-y-2 p-3 rounded-xl border border-outline-variant/10">
            <input className="input-field w-full text-sm" value={f.title} onChange={(e) => updateFeature(i, "title", e.target.value)} placeholder="العنوان" />
            <input className="input-field w-full text-sm" value={f.icon} onChange={(e) => updateFeature(i, "icon", e.target.value)} placeholder="أيقونة" />
            <textarea className="input-field w-full text-sm min-h-[60px]" value={f.description} onChange={(e) => updateFeature(i, "description", e.target.value)} placeholder="الوصف" />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">reviews</span>
            آراء العملاء (من الإدارة)
          </h3>
          <button
            type="button"
            onClick={addTestimonial}
            className="text-xs font-bold text-primary px-3 py-1.5 rounded-lg border border-primary-container/30"
          >
            إضافة رأي
          </button>
        </div>
        {config.testimonials.map((t, i) => (
          <div key={i} className="space-y-2 p-3 rounded-xl border border-outline-variant/10">
            <input className="input-field w-full text-sm" value={t.name} onChange={(e) => updateTestimonial(i, "name", e.target.value)} placeholder="الاسم" />
            <input className="input-field w-full text-sm" value={t.role} onChange={(e) => updateTestimonial(i, "role", e.target.value)} placeholder="الصفة" />
            <textarea className="input-field w-full text-sm min-h-[60px]" value={t.text} onChange={(e) => updateTestimonial(i, "text", e.target.value)} placeholder="الرأي" />
            <button type="button" onClick={() => removeTestimonial(i)} className="text-xs text-red-400 font-bold">حذف</button>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">rate_review</span>
          آراء الزوار (مراجعة ونشر)
        </h3>
        {submissions.length === 0 ? (
          <p className="text-sm text-on-surface-variant">لا توجد آراء مُرسلة من الزوار بعد</p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto sidebar-scroll">
            {submissions.map((sub) => (
              <div key={sub.id} className="p-4 rounded-xl border border-outline-variant/10 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{sub.name}</strong>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-outline-variant/30 text-on-surface-variant">
                    {sub.status_label}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">{sub.text}</p>
                <div className="flex flex-wrap gap-2">
                  {sub.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => reviewSubmission(sub.id, { status: "approved", show_on_landing: true })}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400"
                    >
                      موافقة ونشر
                    </button>
                  )}
                  {sub.status === "approved" && (
                    <button
                      type="button"
                      onClick={() => reviewSubmission(sub.id, { show_on_landing: !sub.show_on_landing })}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-primary-container/30 text-primary"
                    >
                      {sub.show_on_landing ? "إخفاء من الهبوط" : "عرض في الهبوط"}
                    </button>
                  )}
                  {sub.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => reviewSubmission(sub.id, { status: "rejected", show_on_landing: false })}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-400"
                    >
                      رفض
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => promoteToConfig(sub)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant"
                  >
                    إضافة للقائمة الثابتة
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6 space-y-4">
        <h3 className="font-bold text-on-surface">عناوين الأقسام والتواصل</h3>
        <input className="input-field w-full" value={config.gallery_title} onChange={(e) => setConfig({ ...config, gallery_title: e.target.value })} placeholder="عنوان المعرض" />
        <input className="input-field w-full" value={config.video_section_title} onChange={(e) => setConfig({ ...config, video_section_title: e.target.value })} placeholder="عنوان قسم الفيديو" />
        <input className="input-field w-full" type="email" value={config.contact_email} onChange={(e) => setConfig({ ...config, contact_email: e.target.value })} placeholder="بريد التواصل" />
        <input className="input-field w-full" value={config.contact_phone} onChange={(e) => setConfig({ ...config, contact_phone: e.target.value })} placeholder="هاتف التواصل" />
        <input className="input-field w-full" value={config.meta_title} onChange={(e) => setConfig({ ...config, meta_title: e.target.value })} placeholder="SEO عنوان" />
        <input className="input-field w-full" value={config.meta_description} onChange={(e) => setConfig({ ...config, meta_description: e.target.value })} placeholder="SEO وصف" />
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={save} className="px-6 py-3 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container disabled:opacity-50">
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
        <button type="button" disabled={saving} onClick={seedDefaults} className="px-6 py-3 rounded-xl text-sm font-bold border border-outline-variant/30 text-on-surface-variant">
          استعادة الافتراضي
        </button>
      </div>

      <p className="text-xs text-outline">
        الأسئلة من الزوار تُرد من «الأسئلة والاستفسارات». الصفحات الثابتة والروابط من أقسامها. الوسائط من «الوسائط العامة».
      </p>
    </div>
  );
}
