"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnnouncementPublicItem } from "@/lib/api";

function MsIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined landing-ms-icon ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export default function AnnouncementVideoCarousel({ items }: { items: AnnouncementPublicItem[] }) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const count = items.length;

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count <= 1) return;
    const current = items[index];
    if (current.embed_url) {
      const duration = (current.display_duration || 8) * 1000;
      const t = window.setTimeout(goNext, duration);
      return () => window.clearTimeout(t);
    }
  }, [index, count, items, goNext]);

  const onVideoEnded = () => {
    if (count > 1) goNext();
  };

  if (count === 0) return null;

  const current = items[index];

  return (
    <section id="announcement-videos" className="py-12 sm:py-16 border-y border-outline-variant/10 bg-surface-container-low/30">
      <div className="container max-w-6xl px-4 sm:px-6">
        <div className="text-center mb-8">
          <span className="landing-section-badge mb-3">فيديو</span>
          <h2 className="landing-section-title">فيديوهات إعلانية</h2>
        </div>

        <div className="landing-card p-3 sm:p-4 relative group max-w-4xl mx-auto">
          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
            {current.embed_url ? (
              <iframe
                src={current.embed_url}
                title={current.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : current.video_file_url ? (
              <video
                ref={videoRef}
                key={current.id}
                src={current.video_file_url}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
                onEnded={onVideoEnded}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-outline">
                <MsIcon name="videocam_off" className="!text-4xl" />
              </div>
            )}
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-black/50 text-white flex items-center justify-center hover:bg-primary-container transition-colors"
                aria-label="الفيديو السابق"
              >
                <MsIcon name="chevron_left" />
              </button>
              <button
                type="button"
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-black/50 text-white flex items-center justify-center hover:bg-primary-container transition-colors"
                aria-label="الفيديو التالي"
              >
                <MsIcon name="chevron_right" />
              </button>
            </>
          )}

          <div className="mt-4 sm:mt-5 px-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-on-surface">{current.title}</h3>
                {current.description && (
                  <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{current.description}</p>
                )}
              </div>
              {count > 1 && (
                <span className="text-xs font-bold text-outline tabular-nums shrink-0">
                  {index + 1} / {count}
                </span>
              )}
            </div>
            {current.link_url && (
              <a
                href={current.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-primary mt-3 hover:underline"
              >
                تعرف أكثر
                <MsIcon name="open_in_new" className="!text-sm" />
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
