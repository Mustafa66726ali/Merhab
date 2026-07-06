"use client";

import { useState } from "react";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";

type EventCoverVariant = "thumb" | "banner" | "hero";

interface EventCoverImageProps {
  coverImage?: string | null;
  alt?: string;
  variant?: EventCoverVariant;
  className?: string;
  showFallbackIcon?: boolean;
}

const variantStyles: Record<EventCoverVariant, string> = {
  thumb: "rounded-lg sm:rounded-xl",
  banner: "rounded-xl",
  hero: "rounded-none",
};

export default function EventCoverImage({
  coverImage,
  alt = "",
  variant = "thumb",
  className = "",
  showFallbackIcon = true,
}: EventCoverImageProps) {
  const [failed, setFailed] = useState(false);
  const src = coverImage ? getMediaUrl(coverImage) : "";
  const showImage = src && !failed;

  if (showImage) {
    return (
      <img
        src={src}
        alt={variant === "thumb" ? "" : alt}
        className={`w-full h-full object-cover ${variantStyles[variant]} ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (!showFallbackIcon) {
    return (
      <div
        className={`w-full h-full bg-gradient-to-br from-primary-container/25 to-surface-container-high ${variantStyles[variant]} ${className}`}
      />
    );
  }

  return (
    <div
      className={`w-full h-full bg-gradient-to-br from-primary-container/20 to-surface-container-high flex items-center justify-center ${variantStyles[variant]} ${className}`}
    >
      <span
        aria-hidden="true"
        className={`material-symbols-outlined text-primary/40 overflow-hidden leading-none select-none ${
          variant === "hero" ? "text-6xl" : variant === "banner" ? "text-5xl" : "text-xl"
        }`}
      >
        celebration
      </span>
    </div>
  );
}
