"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { platformsAPI } from "@/lib/api";

export default function EditPlatformPage() {
  const params = useParams();
  const id = Number(params.id);
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [status, setStatus] = useState<"active" | "blocked">("active");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    platformsAPI.get(id).then((r) => {
      setName(r.data.name);
      setOwnerName(r.data.owner_name);
      setOwnerEmail(r.data.owner_email);
      setStatus(r.data.status);
      setDescription(r.data.description || "");
      setLoading(false);
    }).catch(() => {
      setError("فشل تحميل بيانات المنصة");
      setLoading(false);
    });
  }, [id]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await platformsAPI.update(id, {
        name: name.trim(),
        owner_email: ownerEmail.trim(),
        owner_name: ownerName.trim(),
        status,
        description: description.trim(),
      });
      router.push("/platforms");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data;
      setError(data?.detail as string || data?.owner_email?.[0] || "فشل تحديث المنصة");
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
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <Link href="/platforms" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-4">
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          العودة إلى ادارة المنصات
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold font-headline">تعديل المنصة</h1>
      </div>

      <form onSubmit={onSubmit} className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6 sm:p-8 space-y-5">
        {error && <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 p-3 rounded-xl">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs mb-2 text-on-surface-variant">اسم المنصة</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs mb-2 text-on-surface-variant">اسم المالك</label>
            <input className="input-field" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs mb-2 text-on-surface-variant">البريد الإلكتروني</label>
            <input type="email" dir="ltr" className="input-field" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-2 text-on-surface-variant">الحالة</label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value as "active" | "blocked")}>
              <option value="active">نشطة</option>
              <option value="blocked">محظورة</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs mb-2 text-on-surface-variant">الوصف</label>
            <textarea className="input-field min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-outline-variant/10">
          <Link href="/platforms" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border border-outline-variant/30">
            <span className="material-symbols-outlined">close</span>
            إلغاء
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">
            {submitting ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </form>
    </div>
  );
}
