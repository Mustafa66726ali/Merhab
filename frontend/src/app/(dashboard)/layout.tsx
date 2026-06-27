"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/api";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated, setUser, setPlatform, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (isAuthenticated && user?.role === "system_manager") {
      setChecking(false);
      return;
    }

    authAPI
      .me()
      .then((r) => {
        if (r.data.role === "platform_admin") {
          router.replace("/platform/dashboard");
          return;
        }
        if (r.data.role !== "system_manager") {
          logout();
          router.replace("/login");
        } else {
          setUser(r.data);
          setPlatform(null);
          setChecking(false);
        }
      })
      .catch(() => {
        logout();
        router.replace("/login");
      });
  }, []);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0d18]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5b2eff] to-[#c8bfff] flex items-center justify-center shadow-lg shadow-[#5b2eff]/30 animate-pulse">
            <span className="material-symbols-outlined text-white text-3xl">diamond</span>
          </div>
          <span className="animate-spin w-8 h-8 border-4 border-[#5b2eff] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0d0d18] text-on-surface">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0 lg:mr-[280px]">
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
