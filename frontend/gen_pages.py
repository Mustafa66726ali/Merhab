import os
BASE = r"d:\Merhab\frontend\src"

def w(path: str, content: str):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK: {path}")

def fix(s: str) -> str:
    return s.replace("CLOSE_", "\x3c/")

# Dashboard page (uses (dashboard) layout)
w("app/(dashboard)/page.tsx", fix('''"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/api";
import StatCard from "@/components/StatCard";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    (async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem("access_token") : null;
      if (!token) { router.push("/login"); return; }
      if (!isAuthenticated) {
        try {
          const r = await authAPI.me();
          setUser(r.data);
        } catch(e) {
          localStorage.removeItem("access_token");
          router.push("/login");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    })();
  }, []);

  if (isLoading) return (CLOSE_div className="flex items-center justify-center h-[60vh]"><span className="animate-spin w-12 h-12 border-4 border-primary-container border-t-transparent rounded-full" />CLOSE_div>);

  return (
    CLOSЕ_div className="p-4 md:p-8 space-y-8">
      CLOSЕ_div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        CLOSЕ_div>
          <h1 className="text-3xl font-extrabold text-on-surface mb-1">لوحة التحكم</h1>
          <p className="text-on-surface-variant">نظرة شاملة على أداء المنصة والفعاليات.</p>
        CLOSЕ_div>
        <button className="flex items-center gap-2 bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-bold hover:brightness-110 transition-all shadow-lg shadow-primary-container/30 active:scale-95">
          <span className="material-symbols-outlined">add</span>
          <span>إضافة فعالية جديدة</span>
        </button>
      CLOSЕ_div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard title="عدد الفعاليات" value="1,284" icon="calendar_today" trend={{ value: "12%", positive: true }} />
        <StatCard title="عدد المستخدمين" value="45.2K" icon="group" color="tertiary" trend={{ value: "8%", positive: true }} />
        <StatCard title="إجمالي المدعوين" value="128,930" icon="person_add" trend={{ value: "2%", positive: false }} />
        <StatCard title="نسبة التفاعل" value="94.2%" icon="analytics" color="emerald" trend={{ value: "5%", positive: true }} />
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">أحدث المستخدمين</h3>
          <button className="p-2 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-white transition-all">
            <span className="material-symbols-outlined text-lg">filter_list</span>
          </button>
        </div>
        <div className="space-y-4">
          {[
            { name: "محمد العبدالله", email: "m.abdullah@example.com", role: "منظم فعاليات", events: 42, date: "12 مايو" },
            { name: "سارة القحطاني", email: "sara.q@domain.sa", role: "مديرة تسويق", events: 18, date: "10 مايو" },
            { name: "فهد بن محمد", email: "fahad.m@web.com", role: "مالك منشأة", events: 65, date: "08 مايو" },
          ].map((u) => (
            CLOSЕ_div key={u.email} className="flex items-center justify-between group hover:bg-surface-container-high/30 p-2 rounded-xl transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">{u.name[0]}</div>
                <div>
                  <p className="font-bold text-sm text-on-surface">{u.name}</p>
                  <p className="text-xs text-on-surface-variant">{u.email}</p>
                </div>
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm text-on-surface">{u.role}</p>
                <p className="text-[10px] text-on-surface-variant">تاريخ التسجيل: {u.date}</p>
              </div>
              <div className="hidden md:flex items-center gap-6">
                <div className="text-right">
                  <span className="text-sm font-bold">{u.events} فعالية</span>
                  <p className="text-[10px] text-on-surface-variant">إجمالي النشاط</p>
                </div>
                <button className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-container hover:bg-primary-container/20 transition-all text-on-surface-variant hover:text-primary">
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
              </div>
            CLOSЕ_div>
          ))}
        </div>
      </div>
    CLOSЕ_div>
  );
}
'''))

# Login page
w("app/login/page.tsx", fix('''"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const { login, setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await authAPI.login(username, password);
      const { access, refresh, user } = r.data;
      login(user, access, refresh);
      setUser(user);
      router.push("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    CLOSЕ_div className="min-h-screen flex items-center justify-center p-4 bg-[#0d0d18]">
      <form onSubmit={onSubmit} className="w-full max-w-md glass-card p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-[#5b2eff] to-[#c8bfff] flex items-center justify-center shadow-lg shadow-[#5b2eff]/20">
            <span className="material-symbols-outlined text-white">diamond</span>
          </div>
          <h1 className="text-xl font-extrabold">مرحّاب</h1>
          <p className="text-xs text-on-surface-variant">تسجيل الدخول للوحة التحكم</p>
        </div>
        {error && (<div className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 p-2 rounded-lg">{error}</div>)}
        <div>
          <label className="block text-xs mb-1">اسم المستخدم</label>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} className="input-field" placeholder="admin" />
        </div>
        <div>
          <label className="block text-xs mb-1">كلمة المرور</label>
          <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="input-field" placeholder="••••••••" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-base">login</span>
          <span>{loading ? "جاري الدخول..." : "تسجيل الدخول"}</span>
        </button>
      </form>
    CLOSЕ_div>
  );
}
'''))
