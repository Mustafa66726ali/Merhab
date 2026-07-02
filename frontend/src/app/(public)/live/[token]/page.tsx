"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicBroadcastAPI, type PublicBroadcast } from "@/lib/api";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";
import LiveMediaPlayer from "@/components/invitation/LiveMediaPlayer";

export default function PublicBroadcastPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [data, setData] = useState<PublicBroadcast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await publicBroadcastAPI.get(token);
      setData(res.data);
    } catch {
      setError("تعذّر تحميل البث — تأكد من صحة الرابط");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const pollLive = useCallback(async () => {
    try {
      const res = await publicBroadcastAPI.liveMedia(token);
      setData((prev) => (prev ? { ...prev, live_media: res.data } : prev));
    } catch {
      /* تجاهل */
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  useEffect(() => {
    if (!data?.live_media?.enabled) return;
    const lm = data.live_media;
    const needsPoll =
      lm.mode === "microphone" || lm.mode === "camera" || lm.stream_active;
    if (!needsPoll) return;
    const id = window.setInterval(pollLive, 3500);
    return () => window.clearInterval(id);
  }, [data, pollLive]);

  if (loading) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-32">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-on-surface-variant text-sm">جارِ تحميل البث...</p>
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-32 text-center px-6">
          <span className="material-symbols-outlined text-6xl text-error">error</span>
          <p className="text-on-surface font-bold text-lg">{error || "البث غير متاح"}</p>
        </div>
      </Page>
    );
  }

  const { event, live_media } = data;

  return (
    <Page>
      <main className="max-w-lg mx-auto px-4 py-10 space-y-8">
        <header className="text-center space-y-3">
          <span className="uppercase tracking-[0.2em] text-primary font-bold text-xs">
            {event.platform_name || "بث مباشر"}
          </span>
          <h1 className="arabic-display text-3xl font-extrabold text-on-surface">{event.title}</h1>
          <div className="w-12 h-1 bg-primary mx-auto rounded-full" />
        </header>

        {event.cover_image && (
          <div className="relative h-48 rounded-2xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getMediaUrl(event.cover_image)}
              alt={event.title}
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          </div>
        )}

        <LiveMediaPlayer live={live_media} />

        <footer className="text-center pt-4 pb-8">
          <p className="text-sm text-on-surface-variant">مرحّاب — حيث تبدأ الحفاوة</p>
        </footer>
      </main>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface overflow-x-hidden">
      {children}
    </div>
  );
}
