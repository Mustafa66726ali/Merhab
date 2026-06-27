"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { AnnouncementPublicItem } from "@/lib/api";

function MsIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined landing-ms-icon ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export default function AnnouncementBannerSlider({ items }: { items: AnnouncementPublicItem[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = items.length;

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => (i + dir + count) % count);
    },
    [count]
  );

  const goTo = useCallback((i: number) => {
    setIndex(i);
  }, []);

  const pauseAutoPlay = useCallback(() => {
    setPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => setPaused(false), 8000);
  }, []);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const duration = (items[index]?.display_duration || 5) * 1000;
    const t = window.setTimeout(() => go(1), duration);
    return () => window.clearTimeout(t);
  }, [index, count, items, go, paused]);

  if (count === 0) return null;

  const current = items[index];

  const slideInner = (
    <div className="relative w-full h-full min-h-[140px] sm:min-h-[168px] max-h-[294px]">
      {current.image_url ? (
        <img
          src={current.image_url}
          alt={current.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full min-h-[140px] bg-gradient-to-br from-primary-container/30 to-surface-container-high flex items-center justify-center">
          <MsIcon name="campaign" className="!text-4xl text-primary opacity-50" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 text-right pointer-events-none">
        <h3 className="text-base sm:text-xl font-bold text-white mb-1 font-headline line-clamp-1">
          {current.title}
        </h3>
        {current.description && (
          <p className="text-xs sm:text-sm text-white/85 leading-relaxed line-clamp-2">{current.description}</p>
        )}
      </div>
    </div>
  );

  return (
    <section id="announcements" className="container max-w-6xl px-4 sm:px-6 py-10 sm:py-12">
      <div className="text-center mb-6">
        <span className="landing-section-badge mb-3">إعلانات</span>
        <h2 className="landing-section-title text-2xl sm:text-3xl">الإعلانات والعروض</h2>
      </div>

      <div className="mx-auto w-full max-w-[70%]">
        <div className="landing-card overflow-hidden relative group aspect-[21/9] sm:aspect-[2.4/1] max-h-[294px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {current.link_url ? (
                <a
                  href={current.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full h-full no-underline"
                  onClick={pauseAutoPlay}
                >
                  {slideInner}
                </a>
              ) : (
                slideInner
              )}
            </motion.div>
          </AnimatePresence>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => {
                  pauseAutoPlay();
                  go(-1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl bg-black/45 text-white flex items-center justify-center hover:bg-primary-container transition-colors"
                aria-label="السابق"
              >
                <MsIcon name="chevron_left" className="!text-lg" />
              </button>
              <button
                type="button"
                onClick={() => {
                  pauseAutoPlay();
                  go(1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-xl bg-black/45 text-white flex items-center justify-center hover:bg-primary-container transition-colors"
                aria-label="التالي"
              >
                <MsIcon name="chevron_right" className="!text-lg" />
              </button>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                {items.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      pauseAutoPlay();
                      goTo(i);
                    }}
                    className={`h-1.5 rounded-full transition-all ${
                      i === index ? "w-5 bg-primary-container" : "w-1.5 bg-white/55 hover:bg-white/80"
                    }`}
                    aria-label={`شريحة ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
