"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicContentAPI, type PublicStaticPage, type PublicStaticPageListItem } from "@/lib/api";

export default function PublicStaticPageView() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [page, setPage] = useState<PublicStaticPage | null>(null);
  const [footerPages, setFooterPages] = useState<PublicStaticPageListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(false);
    Promise.all([
      publicContentAPI.getPage(slug),
      publicContentAPI.listPages("footer"),
    ])
      .then(([pageRes, footerRes]) => {
        setPage(pageRes.data);
        setFooterPages(footerRes.data);
      })
      .catch(() => {
        setPage(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-5xl text-outline/40 mb-4">error</span>
        <h1 className="text-xl font-bold text-on-surface mb-2">الصفحة غير موجودة</h1>
        <p className="text-on-surface-variant text-sm mb-6">قد تكون الصفحة غير منشورة أو الرابط غير صحيح</p>
        <Link href="/landing" className="text-sm font-bold text-primary hover:underline">
          العودة لصفحة الهبوط
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest text-on-surface">
      <header className="border-b border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/landing" className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary">
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            مرحّاب
          </Link>
          <Link href="/login" className="text-xs font-bold text-primary">تسجيل الدخول</Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">{page.display_icon}</span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline">{page.title}</h1>
            {page.subtitle && (
              <p className="text-sm text-on-surface-variant mt-1">{page.subtitle}</p>
            )}
          </div>
        </div>

        <article
          className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6 sm:p-8 text-on-surface-variant leading-relaxed space-y-4 [&_h3]:text-on-surface [&_h3]:font-bold [&_h3]:text-lg [&_ul]:list-disc [&_ul]:pr-5 [&_a]:text-primary"
          dangerouslySetInnerHTML={{ __html: page.content }}
        />

        {page.updated_at && (
          <p className="text-xs text-outline mt-6 text-center">
            آخر تحديث:{" "}
            {new Date(page.updated_at).toLocaleDateString("ar-SA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
      </main>

      <footer className="border-t border-outline-variant/10 bg-surface-container-low mt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {footerPages.map((p) => (
              <Link
                key={p.slug}
                href={`/pages/${p.slug}`}
                className={`text-xs font-bold transition-colors ${
                  p.slug === slug ? "text-primary" : "text-on-surface-variant hover:text-primary"
                }`}
              >
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
