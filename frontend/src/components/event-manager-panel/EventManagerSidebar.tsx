"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PlatformBrand from "@/components/platform-panel/PlatformBrand";

const navItems = [
  { href: "/event-manager/dashboard", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/event-manager/events", label: "المناسبات", icon: "calendar_month" },
  { href: "/event-manager/groups", label: "المجموعات والأقسام", icon: "grid_view" },
  { href: "/event-manager/guests", label: "الضيوف", icon: "group" },
  { href: "/event-manager/schedule", label: "الجدول الزمني", icon: "schedule" },
  { href: "/event-manager/seating", label: "توزيع المقاعد", icon: "event_seat" },
  { href: "/event-manager/invitations", label: "الدعوات", icon: "mail" },
  { href: "/event-manager/messages", label: "الرسائل", icon: "forum" },
  { href: "/event-manager/team", label: "فريق العمل", icon: "groups" },
  { href: "/event-manager/staff", label: "المنسقون ومدراء الدخول", icon: "badge" },
  { href: "/event-manager/settings", label: "الإعدادات", icon: "settings" },
];

interface EventManagerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EventManagerSidebar({ isOpen, onClose }: EventManagerSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 h-screen w-72 max-w-[85vw] z-50 border-l border-outline-variant/20 bg-[#0d0d18]/95 backdrop-blur-xl flex flex-col shadow-2xl shadow-black/50 transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="shrink-0 px-6 pt-8 pb-4 border-b border-outline-variant/10">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 text-on-surface-variant"
              aria-label="إغلاق القائمة"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <PlatformBrand variant="sidebar" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto sidebar-scroll px-4 py-4 space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/event-manager/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${
                  active
                    ? "bg-[#5B2EFF]/15 text-[#e3e0f1] relative before:absolute before:right-0 before:top-0 before:h-full before:w-1 before:bg-[#5B2EFF] before:rounded-l"
                    : "text-[#c9c3da] hover:text-white hover:bg-[#5B2EFF]/10"
                }`}
              >
                <span className="material-symbols-outlined">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
