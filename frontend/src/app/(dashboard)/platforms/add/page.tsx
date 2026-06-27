"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { platformsAPI } from "@/lib/api";

const DEFAULT_PASSWORD = "12345678";

export default function AddPlatformPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await platformsAPI.create({
        name: name.trim(),
        owner_name: ownerName.trim(),
        owner_email: ownerEmail.trim(),
        owner_password: ownerPassword,
        status: "active",
        description: description.trim(),
      });
      router.push("/platforms");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: Record<string, string | string[]> } })?.response?.data;
      const msg =
        data?.owner_email?.[0] ||
        data?.owner_password?.[0] ||
        data?.name?.[0] ||
        (typeof data?.detail === "string" ? data.detail : null) ||
        "فشل إنشاء المنصة";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto">
      <div className="mb-6 sm:mb-8">
        <Link
          href="/platforms"
          className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary mb-4 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_forward</span>
          العودة إلى ادارة المنصات
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">إضافة منصة</h1>
        <p className="text-sm text-on-surface-variant mt-2">
          سيتم إنشاء حساب <strong className="text-primary">مدير منصة</strong> تلقائياً (ليس مدير نظام).
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="bg-surface-container-low rounded-2xl border border-outline-variant/10 p-6 sm:p-8 space-y-5 shadow-xl shadow-black/20"
      >
        {error && (
          <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 p-3 rounded-xl flex items-start gap-2">
            <span className="material-symbols-outlined text-lg shrink-0">error</span>
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-2 text-on-surface-variant">اسم المنصة</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="مثال: منصة الفعاليات الذهبية"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 text-on-surface-variant">اسم المالك</label>
            <input
              className="input-field"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              required
              placeholder="مثال: أحمد السعدني"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 text-on-surface-variant">البريد الإلكتروني</label>
            <input
              type="email"
              dir="ltr"
              className="input-field"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
              placeholder="owner@platform.com"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-2 text-on-surface-variant">كلمة المرور</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="input-field pl-12"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                onClick={() => setShowPassword((v) => !v)}
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5">الافتراضي: 12345678 — يُستخدم لتسجيل دخول مدير المنصة</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-2 text-on-surface-variant">الوصف (اختياري)</label>
            <textarea
              className="input-field min-h-[88px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-outline-variant/10">
          <Link
            href="/platforms"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-all"
          >
            <span className="material-symbols-outlined text-lg">close</span>
            إلغاء
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center justify-center gap-2 flex-1 py-3 text-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            {loading ? "جاري الإضافة..." : "إضافة المنصة"}
          </button>
        </div>
      </form>
    </div>
  );
}
