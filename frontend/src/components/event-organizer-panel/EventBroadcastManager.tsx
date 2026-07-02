"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";
import { eventsAPI, type EventLiveMedia } from "@/lib/api";

type LiveMode = EventLiveMedia["mode"];

const MODES: { value: LiveMode; label: string; icon: string; hint: string }[] = [
  { value: "off", label: "متوقف", icon: "stop_circle", hint: "لا يظهر شيء للضيوف" },
  {
    value: "audio_file",
    label: "ملف صوتي",
    icon: "audio_file",
    hint: "ارفع ملف MP3 أو M4A أو WAV من جهازك",
  },
  {
    value: "youtube",
    label: "يوتيوب",
    icon: "smart_display",
    hint: "رابط فيديو أو بث مباشر على يوتيوب",
  },
  {
    value: "microphone",
    label: "ميكروفون مباشر",
    icon: "mic",
    hint: "بث صوتي مباشر (~3 ثوانٍ تأخير)",
  },
  {
    value: "camera",
    label: "كاميرا مباشرة",
    icon: "videocam",
    hint: "بث فيديو من كاميرا الجهاز",
  },
];

interface EventBroadcastManagerProps {
  eventId: number;
}

export default function EventBroadcastManager({ eventId }: EventBroadcastManagerProps) {
  const [config, setConfig] = useState<EventLiveMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<LiveMode>("off");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [sendResult, setSendResult] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await eventsAPI.getLiveMedia(eventId);
      setConfig(res.data);
      setEnabled(res.data.enabled);
      setMode(res.data.mode);
      setYoutubeUrl(res.data.youtube_url || "");
      setStreaming(res.data.stream_active);
    } catch {
      setError("تعذّر تحميل إعدادات البث");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
    return () => {
      loopRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [load]);

  const saveSettings = async (overrides?: Partial<{ enabled: boolean; mode: LiveMode }>) => {
    setSaving(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("enabled", String(overrides?.enabled ?? enabled));
      fd.append("mode", overrides?.mode ?? mode);
      if (youtubeUrl.trim()) fd.append("youtube_url", youtubeUrl.trim());
      if (audioFile) fd.append("audio_file", audioFile);
      const res = await eventsAPI.updateLiveMedia(eventId, fd);
      setConfig(res.data);
      setEnabled(res.data.enabled);
      setMode(res.data.mode);
      setAudioFile(null);
    } catch {
      setError("تعذّر حفظ الإعدادات — تحقق من رابط يوتيوب أو الملف");
    } finally {
      setSaving(false);
    }
  };

  const uploadChunk = async (blob: Blob) => {
    const fd = new FormData();
    fd.append("chunk", blob, "live.webm");
    const res = await eventsAPI.uploadLiveStreamChunk(eventId, fd);
    setConfig(res.data);
  };

  const recordLoop = async (mediaStream: MediaStream, withVideo: boolean) => {
    loopRef.current = true;
    while (loopRef.current) {
      const mime = withVideo
        ? MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

      const blob = await new Promise<Blob>((resolve, reject) => {
        try {
          const recorder = new MediaRecorder(mediaStream, { mimeType: mime });
          const chunks: BlobPart[] = [];
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
          recorder.onerror = () => reject(new Error("recorder"));
          recorder.start();
          window.setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 3000);
        } catch (err) {
          reject(err);
        }
      });

      if (!loopRef.current) break;
      if (blob.size > 0) {
        try {
          await uploadChunk(blob);
        } catch {
          setError("تعذّر رفع مقطع البث — تحقق من الاتصال");
          break;
        }
      }
    }
  };

  const startStream = async () => {
    setError("");
    try {
      await saveSettings({ enabled: true, mode });
      await eventsAPI.startLiveStream(eventId);

      const withVideo = mode === "camera";
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      streamRef.current = mediaStream;
      setStreaming(true);
      void recordLoop(mediaStream, withVideo);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "يُرجى السماح بالوصول للميكروفون/الكاميرا — HTTPS مطلوب في الإنتاج"
          : "تعذّر بدء البث المباشر";
      setError(msg);
      setStreaming(false);
    }
  };

  const stopStream = async () => {
    loopRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
    try {
      await eventsAPI.stopLiveStream(eventId);
      await load();
    } catch {
      setError("تعذّر إيقاف البث");
    }
  };

  const copyBroadcastUrl = async () => {
    const url = config?.broadcast_url;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر نسخ الرابط");
    }
  };

  const sendBroadcastLink = async () => {
    setSendingLink(true);
    setError("");
    setSendResult("");
    try {
      if (!config?.broadcast_url && (mode === "youtube" || mode === "audio_file")) {
        await saveSettings();
      }
      const res = await eventsAPI.sendBroadcastLink(eventId);
      setConfig((prev) => (prev ? { ...prev, broadcast_url: res.data.broadcast_url } : prev));
      const { sent, total, skipped, failed } = res.data;
      setSendResult(
        `تم إرسال الرابط إلى ${sent} من ${total} ضيف` +
          (skipped ? ` (${skipped} بدون رقم)` : "") +
          (failed ? ` — ${failed} يحتاج إرسالاً يدوياً` : "")
      );
    } catch (err: unknown) {
      const detail =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response &&
        err.response.data &&
        typeof err.response.data === "object" &&
        "detail" in err.response.data
          ? String((err.response.data as { detail: string }).detail)
          : "تعذّر إرسال الرابط — تأكد من حفظ إعدادات البث";
      setError(detail);
    } finally {
      setSendingLink(false);
    }
  };

  const isStreamMode = mode === "microphone" || mode === "camera";

  const canSendLink =
    enabled &&
    mode !== "off" &&
    (mode === "youtube" || mode === "audio_file" || (isStreamMode && (streaming || config?.stream_active)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-on-surface">تفعيل البث للضيوف</h2>
            <p className="text-xs text-on-surface-variant mt-1">
              يظهر في رابط الدعوة `/i/...` للضيوف المدعوين
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-14 h-8 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-outline-variant/40"}`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${enabled ? "right-1" : "right-7"}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`text-right p-4 rounded-xl border transition-all ${
                mode === m.value
                  ? "border-primary bg-primary-container/10"
                  : "border-outline-variant/15 hover:border-primary/30"
              }`}
            >
              <span className="material-symbols-outlined text-primary">{m.icon}</span>
              <p className="font-bold text-sm mt-2">{m.label}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">{m.hint}</p>
            </button>
          ))}
        </div>

        {mode === "youtube" && (
          <label className="block space-y-2">
            <span className="text-sm font-bold text-on-surface">رابط يوتيوب</span>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              dir="ltr"
            />
          </label>
        )}

        {mode === "audio_file" && (
          <label className="block space-y-2">
            <span className="text-sm font-bold text-on-surface">ملف صوتي</span>
            <input
              type="file"
              accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
            {config?.audio_url && !audioFile && (
              <audio controls src={getMediaUrl(config.audio_url)} className="w-full mt-2" preload="metadata">
                <track kind="captions" />
              </audio>
            )}
          </label>
        )}

        {!isStreamMode && (
          <button
            type="button"
            onClick={() => saveSettings()}
            disabled={saving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-primary disabled:opacity-50"
          >
            {saving ? "جارِ الحفظ..." : "حفظ الإعدادات"}
          </button>
        )}
      </section>

      {isStreamMode && enabled && (
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-high p-5 sm:p-6 space-y-4">
          <h2 className="font-bold text-on-surface">التحكم بالبث المباشر</h2>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            يُرفع مقطع كل 3 ثوانٍ إلى السيرفر — مناسب للإنتاج دون خادم بث منفصل.
            يحتاج HTTPS على السيرفر الحقيقي للوصول للميكروفون/الكاميرا.
          </p>

          {!streaming ? (
            <button
              type="button"
              onClick={startStream}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-error disabled:opacity-50"
            >
              <span className="material-symbols-outlined">fiber_manual_record</span>
              بدء البث
            </button>
          ) : (
            <button
              type="button"
              onClick={stopStream}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-on-surface disabled:opacity-50"
            >
              <span className="material-symbols-outlined">stop_circle</span>
              إيقاف البث
            </button>
          )}

          {config?.stream_active && (
            <p className="text-xs text-emerald-400">
              البث نشط — الإصدار {config.stream_rev}
            </p>
          )}
        </section>
      )}

      {enabled && mode !== "off" && (
        <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-high p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-on-surface">رابط البث للضيوف</h2>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                يُرسل تلقائياً عبر واتساب لجميع الضيوف الذين حضروا أو جلسوا في مقاعدهم
              </p>
            </div>
            <button
              type="button"
              onClick={sendBroadcastLink}
              disabled={sendingLink || !canSendLink}
              title="إرسال رابط البث للحاضرين"
              className="shrink-0 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <span className="material-symbols-outlined">
                {sendingLink ? "hourglass_top" : "send"}
              </span>
            </button>
          </div>

          {config?.broadcast_url && (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={config.broadcast_url}
                dir="ltr"
                className="flex-1 rounded-xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 text-xs sm:text-sm text-on-surface"
              />
              <button
                type="button"
                onClick={copyBroadcastUrl}
                className="px-4 py-3 rounded-xl border border-outline-variant/20 text-sm font-bold text-primary hover:bg-primary-container/10"
              >
                {copied ? "تم النسخ" : "نسخ الرابط"}
              </button>
            </div>
          )}

          {!canSendLink && (
            <p className="text-xs text-on-surface-variant">
              {mode === "youtube" || mode === "audio_file"
                ? "احفظ إعدادات البث أولاً ثم اضغط إرسال"
                : "ابدأ البث المباشر ثم اضغط إرسال"}
            </p>
          )}

          {sendResult && (
            <p className="text-xs text-emerald-400">{sendResult}</p>
          )}
        </section>
      )}
    </div>
  );
}
