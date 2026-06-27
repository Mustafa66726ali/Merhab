"use client";

import { getMediaUrl } from "@/components/common/UserAvatarPicker";
import { useAuthStore } from "@/lib/store";

interface PlatformBrandProps {
  /** compact للهيدر، sidebar للشريط الجانبي */
  variant?: "header" | "sidebar";
  className?: string;
}

export default function PlatformBrand({ variant = "header", className = "" }: PlatformBrandProps) {
  const platform = useAuthStore((s) => s.platform);
  const logoUrl = platform?.logo_url ? getMediaUrl(platform.logo_url) : "";
  const name = platform?.name ?? "";

  const logoCircle = (sizeClass: string) =>
    logoUrl ? (
      <div
        className={`${sizeClass} rounded-full overflow-hidden shrink-0 ring-2 ring-outline-variant/15 bg-surface-container-high`}
      >
        <img
          src={logoUrl}
          alt={name || "شعار المنصة"}
          className="w-full h-full object-cover"
        />
      </div>
    ) : null;

  if (variant === "sidebar") {
    return (
      <div className={`text-right flex-1 min-w-0 ${className}`}>
        {logoUrl ? (
          <div className="flex items-center justify-end gap-3">
            <div className="min-w-0 text-right">
              {name && (
                <p className="text-sm font-bold text-on-surface truncate">{name}</p>
              )}
              <p className="text-on-surface-variant text-xs mt-0.5 tracking-widest opacity-70">
                إدارة المنصة
              </p>
            </div>
            {logoCircle("h-10 w-10")}
          </div>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-tr from-[#5B2EFF] to-[#c8bfff] bg-clip-text text-transparent">
              مرحّاب
            </h1>
            <p className="text-on-surface-variant text-xs mt-1 tracking-widest opacity-70">
              إدارة المنصة
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 sm:gap-3 min-w-0 shrink ${className}`}>
      {logoUrl ? (
        logoCircle("h-8 w-8 sm:h-9 sm:w-9")
      ) : (
        <div className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-[#5B2EFF] to-[#c8bfff] bg-clip-text text-transparent font-headline truncate">
          مرحّاب
        </div>
      )}
    </div>
  );
}
