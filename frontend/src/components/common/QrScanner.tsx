"use client";

import { useEffect, useRef, useState } from "react";

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
  title?: string;
  subtitle?: string;
  /** نص يظهر أسفل الماسح (مثل آخر نتيجة) */
  hint?: string;
}

const REGION_ID = "qr-scanner-region";

/**
 * ماسح QR عبر كاميرا الجهاز (modal). يعمل على الجوال والحاسب.
 * يستدعي onResult عند كل قراءة ناجحة (مع تجاهل التكرار السريع لنفس الرمز).
 */
export default function QrScanner({
  open,
  onClose,
  onResult,
  title = "مسح رمز QR",
  subtitle = "وجّه الكاميرا نحو رمز الضيف",
  hint,
}: QrScannerProps) {
  // نوع scanner من html5-qrcode (يُحمّل ديناميكياً لتفادي SSR)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const [camError, setCamError] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = instance as unknown as {
          stop: () => Promise<void>;
          clear: () => void;
        };
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText: string) => {
            const now = Date.now();
            if (
              decodedText === lastRef.current.text &&
              now - lastRef.current.at < 2500
            ) {
              return;
            }
            lastRef.current = { text: decodedText, at: now };
            onResult(decodedText.trim());
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setCamError("تعذّر فتح الكاميرا — تأكد من منح الإذن واستخدام اتصال آمن");
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
      }
    };
  }, [open, onResult]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-surface-container-low rounded-3xl border border-outline-variant/15 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/10">
          <div>
            <h3 className="font-black text-on-surface text-sm">{title}</h3>
            <p className="text-[11px] text-on-surface-variant">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5">
          {camError ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-error">videocam_off</span>
              <p className="text-on-surface text-sm font-bold mt-3">{camError}</p>
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <div id={REGION_ID} className="w-full h-full [&_video]:object-cover" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-primary/70 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            </div>
          )}
          {hint && (
            <p className="text-center text-xs text-on-surface-variant mt-3">{hint}</p>
          )}
        </div>
      </div>
    </div>
  );
}
