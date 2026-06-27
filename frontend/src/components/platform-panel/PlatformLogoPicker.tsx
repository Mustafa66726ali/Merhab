"use client";

import { useRef, useState } from "react";
import { getMediaUrl } from "@/components/common/UserAvatarPicker";

interface PlatformLogoPickerProps {
  initialUrl?: string | null;
  onChange: (file: File | null) => void;
  onClear: () => void;
  cleared?: boolean;
  disabled?: boolean;
}

export default function PlatformLogoPicker({
  initialUrl,
  onChange,
  onClear,
  cleared,
  disabled,
}: PlatformLogoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const displaySrc =
    preview || (!cleared && initialUrl ? getMediaUrl(initialUrl) : null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    onChange(file);
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-28 h-28 rounded-full border border-outline-variant/20 bg-surface-container-high flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-outline-variant/10">
        {displaySrc ? (
          <img src={displaySrc} alt="شعار المنصة" className="w-full h-full object-cover" />
        ) : (
          <span className="material-symbols-outlined text-4xl text-outline">image</span>
        )}
      </div>
      <div className="space-y-2 flex-1">
        <p className="text-xs font-bold text-on-surface-variant">شعار المنصة</p>
        <p className="text-[11px] text-outline leading-relaxed">
          يظهر في أعلى لوحة التحكم بدلاً من «مرحّاب». PNG أو JPG — حتى 2 ميغابايت.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-primary-container/30 text-primary hover:bg-primary-container/10 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">upload</span>
            رفع شعار
          </button>
          {(displaySrc || initialUrl) && !cleared && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setPreview(null);
                onClear();
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-red-500/25 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">delete</span>
              إزالة
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
