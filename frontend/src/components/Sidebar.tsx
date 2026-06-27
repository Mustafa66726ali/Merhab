"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems: Array<{ href: string; label: string; icon: string; external?: boolean }> = [
  { href: "/dashboard", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/events", label: "الفعاليات", icon: "calendar_today" },
  { href: "/platform-members", label: "اعضاء المنصات", icon: "badge" },
  { href: "/platforms", label: "ادارة المنصات", icon: "dns" },
  { href: "/reports", label: "التقارير والاحصائيات", icon: "analytics" },
  { href: "/static-pages", label: "الصفحات الثابتة", icon: "article" },
  { href: "/landing", label: "صفحة الهبوط", icon: "public", external: true },
  { href: "/landing-page", label: "إعدادات صفحة الهبوط", icon: "tune" },
  { href: "/external-links", label: "الروابط الخارجية", icon: "link" },
  { href: "/integrations", label: "التكاملات الخارجية", icon: "extension" },
  { href: "/faq", label: "الاسئلة والاستفسارات", icon: "quiz" },
  { href: "/announcements", label: "الاعلانات والبانرات", icon: "campaign" },
  { href: "/public-media", label: "الوسائط العامة", icon: "perm_media" },
  { href: "/notifications", label: "الاشعارات", icon: "notifications" },
  { href: "/messages", label: "الرسائل", icon: "mail" },
  { href: "/settings", label: "الإعدادات", icon: "settings" },
  { href: "/backup", label: "النسخ الاحتياطي", icon: "backup" },
  { href: "/activity-logs", label: "سجلات النشاط", icon: "history" },
  { href: "/servers-performance", label: "الخوادم والاداء", icon: "dns" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/landing") return pathname === "/landing";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 h-full w-[280px] max-w-[85vw] border-l border-[#474557]/20 bg-[#0d0d18] flex flex-col z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Header — fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-b border-outline-variant/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 text-[#c9c3da] hover:text-on-surface rounded-lg hover:bg-surface-container-high transition-colors"
              aria-label="إغلاق القائمة"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center justify-end flex-1">
              <div className="text-right">
                <p className="text-[#e3e0f1] font-bold text-base sm:text-lg leading-tight">مدير المنصة</p>
                <p className="text-[#c9c3da] text-[10px] sm:text-xs">نظام مرحّاب لإدارة الفعاليات</p>
              </div>
              <div className="mr-3 sm:mr-4 w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-primary/20 bg-primary-container/15 flex items-center justify-center shadow-lg shadow-primary/10 shrink-0">
                <span className="material-symbols-outlined text-primary text-xl sm:text-2xl">admin_panel_settings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Nav — scrollable */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden sidebar-scroll px-2 sm:px-3 py-3">
          <div className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const className =
                "flex items-center justify-end gap-2 sm:gap-3 py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl transition-all text-sm sm:text-base " +
                (active
                  ? "text-[#5B2EFF] border-r-4 border-[#5B2EFF] bg-gradient-to-l from-[#5B2EFF]/10 to-transparent"
                  : "text-[#c9c3da] hover:bg-[#1b1a26]");

              if (item.external) {
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className={className}
                  >
                    <span className="font-medium truncate">{item.label}</span>
                    <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={className}
                >
                  <span className="font-medium truncate">{item.label}</span>
                  <span className="material-symbols-outlined text-xl shrink-0">{item.icon}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer — fixed */}
        <div className="shrink-0 p-4 sm:p-6 border-t border-outline-variant/10">
          <div className="bg-surface-container-low rounded-2xl p-3 sm:p-4 border border-outline-variant/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-primary font-bold">حالة النظام</span>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <p className="text-[10px] text-on-surface-variant leading-relaxed">
              جميع الخدمات تعمل بكفاءة عالية في الوقت الحالي.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
