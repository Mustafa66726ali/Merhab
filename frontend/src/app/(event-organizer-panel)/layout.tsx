"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import EventOrganizerSidebar from "@/components/event-organizer-panel/EventOrganizerSidebar";
import EventOrganizerHeader from "@/components/event-organizer-panel/EventOrganizerHeader";
import { useAuthStore } from "@/lib/store";
import { authAPI } from "@/lib/api";

function readStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function EventOrganizerPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

    const storedUser = readStored<{ role: string }>("user_info");
    const storedPlatform = readStored<{ id: number; name: string; logo_url?: string }>(
      "platform_info"
    );

    if (storedUser?.role === "event_organizer") {
      if (storedUser) setUser(storedUser as Parameters<typeof setUser>[0]);
      if (storedPlatform) setPlatform(storedPlatform);
      setChecking(false);
    }

    authAPI
      .me()
      .then((r) => {
        const data = r.data;
        if (data.role === "system_manager") {
          router.replace("/dashboard");
          return;
        }
        if (data.role === "platform_admin") {
          router.replace("/platform/dashboard");
          return;
        }
        if (data.role === "event_manager") {
          router.replace("/event-manager/dashboard");
          return;
        }
        if (data.role !== "event_organizer") {
          logout();
          router.replace("/login");
          return;
        }
        setUser(data);
        const platformInfo = data.platform || storedPlatform;
        if (platformInfo) setPlatform(platformInfo);
        setChecking(false);
      })
      .catch(() => {
        if (storedUser?.role === "event_organizer") {
          setChecking(false);
          return;
        }
        logout();
        router.replace("/login");
      });
  }, [logout, router, setPlatform, setUser]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0d0d18]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5b2eff] to-[#c8bfff] flex items-center justify-center shadow-lg shadow-[#5b2eff]/30 animate-pulse">
            <span className="material-symbols-outlined text-white text-3xl">event</span>
          </div>
          <span className="animate-spin w-8 h-8 border-4 border-[#5b2eff] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0d0d18] text-on-surface">
      <EventOrganizerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 lg:mr-[280px]">
        <EventOrganizerHeader
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
