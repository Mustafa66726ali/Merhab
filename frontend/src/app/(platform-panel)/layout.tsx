"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PlatformSidebar from "@/components/platform-panel/PlatformSidebar";
import PlatformHeader from "@/components/platform-panel/PlatformHeader";
import { useAuthStore } from "@/lib/store";
import { authAPI, platformsAPI } from "@/lib/api";

interface PlatformInfo {
  id: number;
  name: string;
  logo_url?: string;
}

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function PlatformPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { setUser, setPlatform, logout } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const storedUser = readStored<{ role: string; platform?: PlatformInfo } & Record<string, unknown>>("user_info");
    const storedPlatform = readStored<{ id: number; name: string; logo_url?: string }>("platform_info");

    if (storedUser) {
      setUser(storedUser as unknown as Parameters<typeof setUser>[0]);
      if (storedPlatform) setPlatform(storedPlatform);
    }

    const finishIfPlatformAdmin = () => {
      if (storedUser?.role === "platform_admin") {
        setChecking(false);
      }
    };

    finishIfPlatformAdmin();

    authAPI
      .me()
      .then((r) => {
        const data = r.data;
        if (data.role === "system_manager") {
          router.replace("/dashboard");
          return;
        }
        if (data.role !== "platform_admin") {
          logout();
          router.replace("/login");
          return;
        }
        setUser(data);
        const platformInfo = data.platform || storedPlatform;
        if (platformInfo) {
          setPlatform(platformInfo);
        }
        setChecking(false);
      })
      .catch(() => {
        if (storedUser?.role === "platform_admin") {
          setChecking(false);
          return;
        }
        logout();
        router.replace("/login");
      });

    if (storedUser?.role === "platform_admin" && !storedPlatform) {
      platformsAPI
        .mySettings()
        .then((r) => {
          const d = r.data;
          setPlatform({ id: d.id, name: d.name, logo_url: d.logo_url });
        })
        .catch(() => undefined);
    }
  }, [logout, router, setPlatform, setUser]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
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
      <PlatformSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:mr-[280px]">
        <PlatformHeader
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 min-w-0 overflow-x-hidden px-4 sm:px-6 lg:px-8 pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
