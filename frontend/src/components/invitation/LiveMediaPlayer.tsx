"use client";

import { useEffect, useRef } from "react";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";
import type { PublicLiveMedia } from "@/lib/api";

interface LiveMediaPlayerProps {
  live: PublicLiveMedia | null | undefined;
  compact?: boolean;
}

export default function LiveMediaPlayer({ live, compact = false }: LiveMediaPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastRevRef = useRef(0);

  useEffect(() => {
    if (!live?.enabled) return;

    if (live.mode === "audio_file" && live.audio_url && audioRef.current) {
      const src = getMediaUrl(live.audio_url);
      if (audioRef.current.src !== src) {
        audioRef.current.src = src;
        audioRef.current.load();
      }
    }

    if (
      live.stream_active &&
      live.stream_url &&
      (live.mode === "microphone" || live.mode === "camera") &&
      live.stream_rev !== lastRevRef.current
    ) {
      lastRevRef.current = live.stream_rev;
      const src = getMediaUrl(live.stream_url);
      const el = live.stream_kind === "video" ? videoRef.current : audioRef.current;
      if (el) {
        el.src = src;
        el.load();
        void el.play().catch(() => {});
      }
    }
  }, [live]);

  if (!live?.enabled || live.mode === "off") {
    return (
      <p className="text-sm text-on-surface-variant text-center py-8">
        البث غير متاح حالياً
      </p>
    );
  }

  const wrapperClass = compact
    ? "space-y-4"
    : "bg-surface-container-high p-6 rounded-[2rem] space-y-4";

  return (
    <section className={wrapperClass}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">
            {live.mode === "camera"
              ? "videocam"
              : live.mode === "youtube"
                ? "smart_display"
                : "graphic_eq"}
          </span>
        </div>
        <div>
          <h3 className="arabic-display font-bold text-on-surface">البث المباشر</h3>
          <p className="text-xs text-on-surface-variant">{live.mode_label}</p>
        </div>
        {live.stream_active && (
          <span className="mr-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/15 text-error text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse" />
            مباشر
          </span>
        )}
      </div>

      {live.mode === "youtube" && live.youtube_embed_url && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={live.youtube_embed_url}
            title="بث يوتيوب"
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {live.mode === "audio_file" && live.audio_url && (
        <audio ref={audioRef} controls className="w-full" preload="metadata">
          <track kind="captions" />
        </audio>
      )}

      {live.mode === "microphone" && (
        <>
          {live.stream_active && live.stream_url ? (
            <audio ref={audioRef} controls autoPlay className="w-full" preload="none">
              <track kind="captions" />
            </audio>
          ) : (
            <p className="text-sm text-on-surface-variant text-center py-4">
              في انتظار بدء البث من المنظم...
            </p>
          )}
        </>
      )}

      {live.mode === "camera" && (
        <>
          {live.stream_active && live.stream_url ? (
            <video
              ref={videoRef}
              controls
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl bg-black aspect-video"
              preload="none"
            />
          ) : (
            <p className="text-sm text-on-surface-variant text-center py-4">
              في انتظار بدء البث من المنظم...
            </p>
          )}
        </>
      )}
    </section>
  );
}
