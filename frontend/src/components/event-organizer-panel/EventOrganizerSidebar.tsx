"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PlatformBrand from "@/components/platform-panel/PlatformBrand";
import { useAuthStore } from "@/lib/store";

type PermKey = "perm_scan_qr" | "perm_edit_guests" | "perm_send_messages";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  perm?: PermKey;
}

const navItems: NavItem[] = [
  { href: "/event-organizer/dashboard", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/event-organizer/events", label: "الفعاليات والمناسبات", icon: "calendar_month" },
  { href: "/event-organizer/schedule", label: "الجدول الزمني", icon: "schedule" },
  { href: "/event-organizer/seating", label: "توزيع المقاعد", icon: "event_seat" },
  { href: "/event-organizer/guests", label: "الضيوف", icon: "group" },
  { href: "/event-organizer/invitations", label: "الدعوات", icon: "mail", perm: "perm_send_messages" },
  { href: "/event-organizer/broadcast", label: "البث المباشر", icon: "podcasts" },
  { href: "/event-organizer/check-in", label: "تسجيل الحضور", icon: "qr_code_scanner", perm: "perm_scan_qr" },
  { href: "/event-organizer/messages", label: "الرسائل", icon: "forum", perm: "perm_send_messages" },
  { href: "/event-organizer/gratitudes", label: "كلمات الشكر", icon: "celebration", perm: "perm_send_messages" },
  { href: "/event-organizer/account", label: "الحساب", icon: "account_circle" },
];

interface EventOrganizerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function EventOrganizerSidebar({
  isOpen,
  onClose,
}: EventOrganizerSidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const membership = user?.membership;

  const visibleItems = navItems.filter(
    (item) => !item.perm || membership?.[item.perm]
  );

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
          {visibleItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/event-organizer/dashboard" && pathname.startsWith(item.href)) ||
              (item.href === "/event-organizer/broadcast" &&
                pathname.includes("/event-organizer/events/") &&
                pathname.endsWith("/broadcast"));
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

        {membership && (
          <div className="shrink-0 px-5 py-4 border-t border-outline-variant/10">
            <p className="text-[10px] font-bold text-[#8b85a0] uppercase tracking-widest mb-2">
              صلاحياتك
            </p>
            <div className="flex flex-wrap gap-1.5">
              {membership.perm_scan_qr && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#5B2EFF]/15 text-[#c8bfff] text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">qr_code_scanner</span>
                  مسح QR
                </span>
              )}
              {membership.perm_edit_guests && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#5B2EFF]/15 text-[#c8bfff] text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                  تعديل الضيوف
                </span>
              )}
              {membership.perm_send_messages && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#5B2EFF]/15 text-[#c8bfff] text-[11px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">mail</span>
                  إرسال رسائل
                </span>
              )}
              {!membership.perm_scan_qr &&
                !membership.perm_edit_guests &&
                !membership.perm_send_messages && (
                  <span className="text-[11px] text-[#8b85a0]">عرض فقط</span>
                )}
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

