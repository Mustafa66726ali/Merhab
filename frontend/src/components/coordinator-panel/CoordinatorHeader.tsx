"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import HeaderComms from "@/components/HeaderComms";
import PlatformBrand from "@/components/platform-panel/PlatformBrand";

interface CoordinatorHeaderProps {
  onMenuToggle: () => void;
  sidebarOpen: boolean;
  accountHref: string;
  defaultRoleLabel: string;
  panelPrefix?: "coordinator" | "entry-manager";
}

export default function CoordinatorHeader({
  onMenuToggle,
  sidebarOpen,
  accountHref,
  defaultRoleLabel,
  panelPrefix = "coordinator",
}: CoordinatorHeaderProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const roleLabel = user?.membership?.role_label || defaultRoleLabel;
  const displayName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.email;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0d0d18]/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(13,13,24,0.6)] flex flex-row-reverse justify-between items-center w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-4 gap-2 mb-4 sm:mb-6 overflow-visible">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-[#c9c3da] hover:text-primary hover:bg-primary-container/10 rounded-lg transition-colors shrink-0"
          aria-label={sidebarOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={sidebarOpen}
        >
          <span className="material-symbols-outlined">
            {sidebarOpen ? "close" : "menu"}
          </span>
        </button>
        <PlatformBrand variant="header" />
        <div className="hidden sm:block h-6 w-px bg-outline-variant/30 shrink-0" />
        <div className="hidden sm:flex items-center gap-3 bg-surface-container-highest px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold text-on-primary-container shrink-0">
          <span>{roleLabel}</span>
          <span
            className="material-symbols-outlined text-[16px]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
        </div>
        {displayName && (
          <span className="hidden md:inline text-sm text-[#c9c3da] truncate max-w-[180px]">
            {displayName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <Link
          href={accountHref}
          className="p-2 sm:p-2.5 text-[#c9c3da] hover:text-primary hover:bg-primary-container/10 transition-all rounded-full"
          title="معلومات الحساب"
        >
          <span className="material-symbols-outlined text-xl sm:text-2xl">account_circle</span>
        </Link>

        <HeaderComms
          messagesHref={`/${panelPrefix}/messages`}
          notificationsHref={`/${panelPrefix}/notifications`}
        />

        <button
          type="button"
          onClick={handleLogout}
          className="p-2 sm:p-2.5 text-[#c9c3da] hover:text-red-400 hover:bg-red-400/10 transition-all rounded-full group"
          title="تسجيل الخروج"
        >
          <span
            className="material-symbols-outlined text-xl sm:text-2xl group-hover:scale-110 transition-transform"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            power_settings_new
          </span>
        </button>
      </div>
    </header>
  );
}
