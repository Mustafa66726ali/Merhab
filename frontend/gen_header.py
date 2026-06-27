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

w("components/Header.tsx", fix('''"use client";
import { useAuthStore } from "@/lib/store";
export default function Header() {
  const { user } = useAuthStore();
  return (
    CLOSE_header className="sticky top-0 z-40 bg-[#0d0d18]/80 backdrop-blur-xl border-b border-outline-variant/20">
      CLOSE_div className="flex items-center justify-between px-6 h-16">
        CLOSE_div className="flex items-center gap-4">
          CLOSE_div className="hidden sm:flex items-center gap-2 text-on-surface-variant text-sm">
            CLOSE_span className="material-symbols-outlined text-base">calendar_todayCLOSE_span>
            CLOSE_span>الفعالياتCLOSE_span>
            CLOSE_span className="material-symbols-outlined text-xs">chevron_leftCLOSE_span>
            CLOSE_span className="font-bold text-primary">لوحة التحكمCLOSE_span>
          CLOSE_div>
        CLOSE_div>
        CLOSE_div className="flex items-center gap-3">
          CLOSE_div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold">
            CLOSE_span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> متصل
          CLOSE_div>
          CLOSE_button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-all relative">
            CLOSE_span className="material-symbols-outlined">notificationsCLOSE_span>
            CLOSE_span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
          CLOSE_button>
          CLOSE_button className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-all">
            CLOSE_span className="material-symbols-outlined">appsCLOSE_span>
          CLOSE_button>
          CLOSE_div className="flex items-center gap-2 mr-2 pr-2 border-r border-outline-variant/20">
            CLOSE_div className="text-right hidden sm:block">
              CLOSE_p className="text-sm font-bold text-on-surface">{user?.first_name || "المستخدم"}CLOSE_p>
              CLOSE_p className="text-[10px] text-on-surface-variant">{user?.role === "system_manager" ? "مدير النظام" : "مستخدم"}CLOSE_p>
            CLOSE_div>
            CLOSE_div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-white font-bold text-sm">
              {user?.first_name?.[0] || "م"}
            CLOSE_div>
          CLOSE_div>
        CLOSE_div>
      CLOSE_div>
    CLOSE_header>
  );
}
'''))
print("Header done")
