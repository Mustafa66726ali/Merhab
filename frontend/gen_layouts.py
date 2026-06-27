import os
BASE = r"d:\Merhab\frontend\src"

def w(path: str, content: str):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK: {path}")

def fix(s: str) -> str:
    # Replace placeholders like CLOSE_div with </div>
    return s.replace("CLOSE_", "\x3c/")

# Root layout with html/body wrapper (server component)
w("app/layout.tsx", fix('''import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    CLOSE_html dir="rtl" lang="ar">
      CLOSE_body>{children}CLOSE_body>
    CLOSE_html>
  );
}
'''))

# Dashboard layout (client component)
w("app/(dashboard)/layout.tsx", fix('''"use client";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    CLOSE_div className="flex h-screen overflow-hidden bg-background">
      CLOSE_Sidebar />
      CLOSE_div className="flex-1 flex flex-col overflow-hidden md:mr-72">
        CLOSE_Header />
        CLOSE_main className="flex-1 overflow-y-auto p-4 md:p-8">{children}CLOSE_main>
      CLOSE_div>
    CLOSE_div>
  );
}
'''))
