import os
BASE = r"d:\Merhab\frontend\src"
def w(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  OK: {path}")
def fix(s):
    return s.replace("CLOSE_", "\x3c/")

print("=== Part 2: Components ===")

# Sidebar
w("components/Sidebar.tsx", fix('''"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const navItems = [
  { href: "/", label: "لوحة التحكم", icon: "dashboard" },
  { href: "/events", label: "الفعاليات", icon: "calendar_month" },
  { href: "/guests", label: "الضيوف", icon: "group" },
  { href: "/tables", label: "توزيع المقاعد", icon: "event_seat" },
  { href: "/sections", label: "الأقسام", icon: "grid_view" },
  { href: "/schedule", label: "الجدول الزمني", icon: "schedule" },
  { href: "/groups", label: "المجموعات", icon: "workspaces" },
  { href: "/staff", label: "فريق العمل", icon: "badge" },
  { href: "/messages", label: "الرسائل", icon: "chat" },
  { href: "/invitations", label: "الدعوات", icon: "mail" },
  { href: "/users", label: "المستخدمين", icon: "people" },
  { href: "/reports", label: "التقارير", icon: "analytics" },
  { href: "/settings", label: "الإعدادات", icon: "settings" },
];
export default function Sidebar() {
  const pathname = usePathname();
  return (
    CLOSE_aside className="fixed right-0 top-0 h-screen w-72 z-50 border-l border-outline-variant/20 bg-[#0d0d18]/90 backdrop-blur-xl flex flex-col py-6 shadow-2xl shadow-black/50">
      CLOSE_div className="px-6 mb-6 flex items-center gap-3">
        CLOSE_div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5b2eff] to-[#c8bfff] flex items-center justify-center shadow-lg shadow-[#5b2eff]/20 shrink-0">
          CLOSE_span className="material-symbols-outlined text-white font-bold text-xl">diamondCLOSE_span>
        CLOSE_div>
        CLOSE_div className="overflow-hidden">
          CLOSE_h1 className="text-xl font-black bg-gradient-to-tr from-[#5B2EFF] to-[#c8bfff] bg-clip-text text-transparent whitespace-nowrap">مرحّابCLOSE_h1>
          CLOSE_p className="text-[10px] text-on-surface-variant/60 uppercase tracking-widest">The Digital MajlisCLOSE_p>
        CLOSE_div>
      CLOSE_div>
      CLOSE_nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            CLOSE_Link key={item.href} href={item.href}
              className={"flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 " + (isActive ? "bg-[#5B2EFF]/15 text-[#e3e0f1]" : "text-[#c9c3da] hover:text-white hover:bg-[#5B2EFF]/10")}>
              CLOSE_span className="material-symbols-outlined text-xl shrink-0" style={isActive ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}CLOSE_span>
              CLOSE_span className="font-medium text-sm whitespace-nowrap">{item.label}CLOSE_span>
            CLOSE_Link>
          );
        })}
      CLOSE_nav>
      CLOSE_div className="px-3 border-t border-outline-variant/10 pt-4 mt-2">
        CLOSE_Link href="/login" className="flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-[#c9c3da] hover:text-error hover:bg-error/10"
          onClick={() => { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); }}>
          CLOSE_span className="material-symbols-outlined text-xl shrink-0">logoutCLOSE_span>
          CLOSE_span className="font-medium text-sm">تسجيل الخروجCLOSE_span>
        CLOSE_Link>
      CLOSE_div>
    CLOSE_aside>
  );
}
'''))

print("Sidebar done")
