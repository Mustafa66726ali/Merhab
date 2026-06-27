"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1").replace(
    /\/api\/v1\/?$/,
    ""
  );

export function getMediaUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

interface UserAvatarPickerProps {
  label?: string;
  previewUrl?: string | null;
  initialUrl?: string | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function UserAvatarPicker({
  label = "الصورة الشخصية (اختياري)",
  previewUrl,
  initialUrl,
  onChange,
  disabled,
}: UserAvatarPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const displaySrc =
    previewUrl || localPreview || (initialUrl ? getMediaUrl(initialUrl) : null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const applyFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setLocalPreview(reader.result as string);
    reader.readAsDataURL(file);
    onChange(file);
    setCameraError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) applyFile(file);
    e.target.value = "";
  };

  const startCamera = async () => {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCameraError("تعذّر فتح الكاميرا — تحقق من الأذونات أو ارفع صورة من الملفات");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `avatar-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        applyFile(file);
        stopCamera();
      },
      "image/jpeg",
      0.92
    );
  };

  const clearImage = () => {
    setLocalPreview(null);
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-on-surface-variant">{label}</label>

      <div className="flex items-center gap-4">
        <div
          className="w-20 h-20 rounded-2xl border border-outline-variant/20 bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0"
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-3xl text-outline">person</span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/25 bg-surface-container-high hover:border-primary-container/40 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            رفع ملف
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={startCamera}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-outline-variant/25 bg-surface-container-high hover:border-primary-container/40 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">photo_camera</span>
            التقاط
          </button>
          {displaySrc && (
            <button
              type="button"
              disabled={disabled}
              onClick={clearImage}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-red-400 border border-red-400/25 hover:bg-red-400/10 disabled:opacity-50"
            >
              إزالة
            </button>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {cameraError && (
        <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {cameraError}
        </p>
      )}

      {cameraOpen && (
        <CameraModal onClose={stopCamera} onCapture={capturePhoto} videoRef={videoRef} />
      )}
    </div>
  );
}

function CameraModal({
  onClose,
  onCapture,
  videoRef,
}: {
  onClose: () => void;
  onCapture: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-surface-container rounded-2xl border border-outline-variant/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-on-surface">التقاط صورة</h4>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-surface-container-high">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="rounded-xl overflow-hidden bg-black aspect-square max-h-[50vh]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            playsInline
            muted
          />
        </div>
        <button
          type="button"
          onClick={onCapture}
          className="w-full py-3 rounded-xl font-bold bg-primary-container text-on-primary-container"
        >
          التقاط الصورة
        </button>
      </div>
    </div>
  );
}

export function UserAvatarThumb({
  name,
  avatarUrl,
  avatarInitial,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  avatarInitial?: string;
  size?: "sm" | "md";
}) {
  const src = getMediaUrl(avatarUrl);
  const dim = size === "sm" ? "w-9 h-9 text-sm" : "w-10 h-10 text-sm";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={`${dim} rounded-full object-cover shrink-0 border border-outline-variant/15`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-tertiary-container/25 text-tertiary font-bold flex items-center justify-center shrink-0`}
    >
      {avatarInitial || name[0] || "?"}
    </div>
  );
}
