"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  publicMediaAPI,
  type PublicMediaItem,
  type PublicMediaOverview,
} from "@/lib/api";

type ModalMode = "create" | "edit" | "delete" | null;

const emptyOverview: PublicMediaOverview = {
  config: {
    hero_title: "",
    hero_subtitle: "",
    hero_description: "",
    hero_cta_primary: "",
    hero_cta_primary_url: "",
    hero_cta_secondary: "",
    hero_cta_secondary_url: "",
    stats: [],
    features: [],
    testimonials: [],
    partners_title: "",
    gallery_title: "",
    video_section_title: "",
    contact_email: "",
    contact_phone: "",
    meta_title: "",
    meta_description: "",
  },
  media: [],
  stats: { total_media: 0, active_media: 0, images: 0, videos: 0 },
  sections: [],
  media_types: [],
};

export default function PublicMediaView() {
  const [overview, setOverview] = useState<PublicMediaOverview>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PublicMediaItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [altText, setAltText] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [section, setSection] = useState("gallery");
  const [videoUrl, setVideoUrl] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await publicMediaAPI.overview();
      setOverview(res.data);
    } catch {
      setOverview(emptyOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setTitle("");
    setDescription("");
    setAltText("");
    setMediaType("image");
    setSection("gallery");
    setVideoUrl("");
    setSortOrder(overview.media.length);
    setIsActive(true);
    setIsFeatured(false);
    setFile(null);
    setThumbnail(null);
    setSelected(null);
    setError("");
    setModalMode("create");
  };

  const openEdit = (item: PublicMediaItem) => {
    setSelected(item);
    setTitle(item.title);
    setDescription(item.description);
    setAltText(item.alt_text);
    setMediaType(item.media_type);
    setSection(item.section);
    setVideoUrl(item.video_url);
    setSortOrder(item.sort_order);
    setIsActive(item.is_active);
    setIsFeatured(item.is_featured);
    setFile(null);
    setThumbnail(null);
    setError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setError("");
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("description", description);
    fd.append("alt_text", altText);
    fd.append("media_type", mediaType);
    fd.append("section", section);
    fd.append("video_url", videoUrl);
    fd.append("sort_order", String(sortOrder));
    fd.append("is_active", String(isActive));
    fd.append("is_featured", String(isFeatured));
    if (file) fd.append("file", file);
    if (thumbnail) fd.append("thumbnail", thumbnail);
    return fd;
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const fd = buildFormData();
      if (modalMode === "create") {
        await publicMediaAPI.createItem(fd);
      } else if (selected) {
        await publicMediaAPI.updateItem(selected.id, fd);
      }
      closeModal();
      await load();
    } catch {
      setError("فشل حفظ الوسيط");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await publicMediaAPI.deleteItem(selected.id);
      closeModal();
      await load();
    } catch {
      setError("فشل الحذف");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = overview.media.filter((m) => !sectionFilter || m.section === sectionFilter);
  const stats = overview.stats;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-container/20">
            <span className="material-symbols-outlined text-primary text-xl">perm_media</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">الوسائط العامة</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              صور وفيديوهات صفحة الهبوط — معرض، هبوط، وأقسام الفيديو
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/landing"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 text-primary bg-primary-container/10"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            معاينة الهبوط
          </Link>
          <Link
            href="/landing-page"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
          >
            إعدادات الهبوط
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container shadow-lg shadow-primary-container/25"
          >
            <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
            إضافة وسيط
          </button>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "إجمالي", value: stats.total_media, icon: "perm_media" },
          { label: "نشط", value: stats.active_media, icon: "check_circle" },
          { label: "صور", value: stats.images, icon: "image" },
          { label: "فيديو", value: stats.videos, icon: "videocam" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
            <span className="material-symbols-outlined text-primary text-lg">{k.icon}</span>
            <p className="text-[10px] font-bold text-on-surface-variant mt-2">{k.label}</p>
            <p className="text-xl font-extrabold font-headline tabular-nums">{k.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="font-bold text-on-surface">مكتبة الوسائط</h3>
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">كل الأقسام</option>
            {overview.sections.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-on-surface-variant py-12 text-sm">لا توجد وسائط — أضف صور أو فيديو لصفحة الهبوط</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-outline-variant/10 bg-surface-container/40 overflow-hidden group hover:border-primary-container/30 transition-all"
              >
                <div className="aspect-video bg-surface-container-high relative">
                  {item.media_type === "image" && item.file_url ? (
                    <img src={item.file_url} alt={item.alt_text || item.title} className="w-full h-full object-cover" />
                  ) : item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  ) : item.embed_url ? (
                    <div className="w-full h-full flex items-center justify-center bg-black/80">
                      <span className="material-symbols-outlined text-4xl text-primary">play_circle</span>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-outline">
                      <span className="material-symbols-outlined text-4xl">
                        {item.media_type.includes("video") ? "videocam" : "image"}
                      </span>
                    </div>
                  )}
                  {!item.is_active && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      معطّل
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-container/15 text-primary border border-primary-container/25">
                      {item.section_label}
                    </span>
                    <span className="text-[10px] text-outline">{item.media_type_label}</span>
                  </div>
                  <h4 className="font-bold text-sm text-on-surface truncate">{item.title}</h4>
                  <div className="flex gap-1 mt-3">
                    <button type="button" onClick={() => openEdit(item)} className="p-2 rounded-lg text-primary hover:bg-primary-container/10">
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item);
                        setModalMode("delete");
                      }}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"
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
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-on-surface mb-4">
              {modalMode === "create" ? "إضافة وسيط" : "تعديل الوسيط"}
            </h2>
            {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
            <div className="space-y-4">
              <input className="input-field w-full" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
              <textarea className="input-field w-full min-h-[72px]" placeholder="الوصف" value={description} onChange={(e) => setDescription(e.target.value)} />
              <select className="input-field w-full" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                {overview.media_types.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <select className="input-field w-full" value={section} onChange={(e) => setSection(e.target.value)}>
                {overview.sections.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {mediaType === "video_url" && (
                <input
                  className="input-field w-full font-mono text-sm"
                  dir="ltr"
                  placeholder="https://youtube.com/..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                />
              )}
              {(mediaType === "image" || mediaType === "video_file") && (
                <div>
                  <label className="text-xs text-on-surface-variant block mb-2">رفع ملف</label>
                  <input type="file" accept={mediaType === "image" ? "image/*" : "video/*"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
                </div>
              )}
              <input className="input-field w-full" placeholder="نص بديل (SEO)" value={altText} onChange={(e) => setAltText(e.target.value)} />
              <input type="number" className="input-field w-full" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="الترتيب" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> نشط
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> مميز
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/30">إلغاء</button>
              <button type="button" disabled={submitting} onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-primary-container text-on-primary-container disabled:opacity-50">
                {submitting ? "جاري الحفظ..." : "حفظ"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMode === "delete" && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-low p-6 border border-outline-variant/20">
            <p className="text-on-surface font-bold mb-4">حذف «{selected.title}»؟</p>
            {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-bold">إلغاء</button>
              <button type="button" disabled={submitting} onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50">حذف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
