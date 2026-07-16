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
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = coverImage ? getMediaUrl(coverImage) : "";
  const showImage = src && failedSrc !== src;

  if (showImage) {
    return (
      <img
        src={src}
        alt={variant === "thumb" ? "" : alt}
        className={`w-full h-full object-cover ${variantStyles[variant]} ${className}`}
        onError={() => setFailedSrc(src)}
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
    <img
      src="/event-cover-default.svg"
      alt={variant === "thumb" ? "" : alt}
      className={`w-full h-full object-cover ${variantStyles[variant]} ${className}`}
    />
  );
}
