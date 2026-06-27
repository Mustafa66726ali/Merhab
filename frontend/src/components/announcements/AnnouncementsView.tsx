"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { announcementsAPI, type AnnouncementItem, type AnnouncementsOverview } from "@/lib/api";

type ModalMode = "create" | "edit" | "delete" | null;
type Tab = "banner" | "video";

const emptyOverview: AnnouncementsOverview = {
  stats: { total: 0, active: 0, banners: 0, videos: 0, on_landing: 0 },
  sections: [],
  media_types: [],
};

export default function AnnouncementsView() {
  const [overview, setOverview] = useState<AnnouncementsOverview>(emptyOverview);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("banner");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<AnnouncementItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [videoUrl, setVideoUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [displayDuration, setDisplayDuration] = useState(5);
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [showOnLanding, setShowOnLanding] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      const [ovRes, listRes] = await Promise.all([
        announcementsAPI.overview(),
        announcementsAPI.list(),
      ]);
      setOverview(ovRes.data);
      setItems(listRes.data);
    } catch {
      setOverview(emptyOverview);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((i) => i.section === tab);

  const openCreate = () => {
    setTitle("");
    setDescription("");
    setMediaType(tab === "banner" ? "image" : "video_file");
    setVideoUrl("");
    setLinkUrl("");
    setDisplayDuration(5);
    setSortOrder(filtered.length);
    setIsActive(true);
    setShowOnLanding(true);
    setImage(null);
    setVideoFile(null);
    setSelected(null);
    setError("");
    setModalMode("create");
  };

  const openEdit = (item: AnnouncementItem) => {
    setSelected(item);
    setTitle(item.title);
    setDescription(item.description);
    setMediaType(item.media_type);
    setVideoUrl(item.video_url);
    setLinkUrl(item.link_url);
    setDisplayDuration(item.display_duration);
    setSortOrder(item.sort_order);
    setIsActive(item.is_active);
    setShowOnLanding(item.show_on_landing);
    setImage(null);
    setVideoFile(null);
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
    fd.append("section", tab);
    fd.append("media_type", tab === "banner" ? "image" : mediaType);
    fd.append("video_url", videoUrl);
    fd.append("link_url", linkUrl);
    fd.append("display_duration", String(displayDuration));
    fd.append("sort_order", String(sortOrder));
    fd.append("is_active", String(isActive));
    fd.append("show_on_landing", String(showOnLanding));
    if (image) fd.append("image", image);
    if (videoFile) fd.append("video_file", videoFile);
    return fd;
  };

  const save = async () => {
    if (!title.trim()) {
      setError("العنوان مطلوب");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const fd = buildFormData();
      if (modalMode === "create") {
        await announcementsAPI.create(fd);
      } else if (selected) {
        await announcementsAPI.update(selected.id, fd);
      }
      await load();
      closeModal();
    } catch {
      setError("فشل الحفظ. تحقق من الحقول والملفات.");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await announcementsAPI.delete(selected.id);
      await load();
      closeModal();
    } catch {
      setError("فشل الحذف");
    } finally {
      setSubmitting(false);
    }
  };

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
            <span className="material-symbols-outlined text-primary text-xl">campaign</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">الإعلانات والبانرات</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              إدارة سلايدر الإعلانات وفيديوهات صفحة الهبوط مع مدة الظهور
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/landing" target="_blank" className="px-3 py-2 rounded-xl text-xs font-bold border border-primary-container/30 text-primary bg-primary-container/10 flex items-center gap-1">
            <span className="material-symbols-outlined text-base">open_in_new</span>
            معاينة الهبوط
          </Link>
          <button type="button" onClick={openCreate} className="landing-btn-primary !py-2 !px-4 !text-xs">
            إضافة {tab === "banner" ? "إعلان" : "فيديو"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "إجمالي", value: overview.stats.total },
          { label: "نشط", value: overview.stats.active },
          { label: "بانرات", value: overview.stats.banners },
          { label: "فيديوهات", value: overview.stats.videos },
          { label: "على الهبوط", value: overview.stats.on_landing },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
            <p className="text-xs text-on-surface-variant">{k.label}</p>
            <p className="text-xl font-bold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("banner")}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
            tab === "banner"
              ? "bg-primary-container/20 border-primary-container/40 text-primary"
              : "border-outline-variant/20 text-on-surface-variant"
          }`}
        >
          إعلانات الصور (سلايدر)
        </button>
        <button
          type="button"
          onClick={() => setTab("video")}
          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
            tab === "video"
              ? "bg-primary-container/20 border-primary-container/40 text-primary"
              : "border-outline-variant/20 text-on-surface-variant"
          }`}
        >
          فيديوهات إعلانية
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-outline-variant/10 bg-surface-container-low">
          <span className="material-symbols-outlined text-4xl text-outline/40 mb-3 block">campaign</span>
          <p className="text-sm text-on-surface-variant">لا توجد عناصر في هذا القسم</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-outline-variant/10 bg-surface-container-low overflow-hidden hover:border-primary-container/30 transition-all"
            >
              <div className="aspect-video bg-surface-container-high relative">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                ) : item.embed_url ? (
                  <div className="w-full h-full flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-4xl">play_circle</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-outline">
                    <span className="material-symbols-outlined text-3xl">perm_media</span>
                  </div>
                )}
                <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white">
                  {item.display_duration}ث
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-sm mb-1 truncate">{item.title}</h3>
                <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{item.description || "—"}</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-outline/10 text-outline"}`}>
                    {item.is_active ? "نشط" : "معطّل"}
                  </span>
                  {item.show_on_landing && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-container/15 text-primary">
                      على الهبوط
                    </span>
                  )}
                </div>
                <button type="button" onClick={() => openEdit(item)} className="text-xs font-bold text-primary">
                  تعديل
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto sidebar-scroll">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">
                {modalMode === "create" ? "إضافة" : "تعديل"} {tab === "banner" ? "إعلان" : "فيديو"}
              </h3>
              <button type="button" onClick={closeModal} className="p-2 rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <input className="input-field" placeholder="العنوان *" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input-field min-h-[80px]" placeholder="الوصف" value={description} onChange={(e) => setDescription(e.target.value)} />

            {tab === "banner" ? (
              <>
                <label className="block text-xs font-bold text-on-surface-variant mb-1">صورة الإعلان</label>
                <input type="file" accept="image/*" className="input-field text-sm" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
              </>
            ) : (
              <>
                <select className="input-field" value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                  <option value="video_file">ملف فيديو</option>
                  <option value="video_url">رابط YouTube / Vimeo</option>
                </select>
                {mediaType === "video_url" ? (
                  <input className="input-field" dir="ltr" placeholder="رابط الفيديو" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
                ) : (
                  <input type="file" accept="video/*" className="input-field text-sm" onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                )}
              </>
            )}

            <input className="input-field" dir="ltr" placeholder="رابط عند النقر (اختياري)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">مدة الظهور (ثانية)</label>
                <input
                  type="number"
                  min={2}
                  max={120}
                  className="input-field"
                  value={displayDuration}
                  onChange={(e) => setDisplayDuration(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface-variant mb-1 block">الترتيب</label>
                <input type="number" className="input-field" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              نشط
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showOnLanding} onChange={(e) => setShowOnLanding(e.target.checked)} />
              عرض في صفحة الهبوط
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <button type="button" disabled={submitting} onClick={save} className="btn-primary px-6 py-3 text-sm">
                {submitting ? "جاري الحفظ..." : "حفظ"}
              </button>
              {modalMode === "edit" && (
                <button type="button" disabled={submitting} onClick={() => setModalMode("delete")} className="px-6 py-3 text-sm font-bold text-red-400">
                  حذف
                </button>
              )}
            </div>

            {modalMode === "delete" && (
              <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
                <p className="text-sm mb-3">تأكيد حذف هذا العنصر؟</p>
                <button type="button" disabled={submitting} onClick={remove} className="text-sm font-bold text-red-400">
                  نعم، احذف
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
