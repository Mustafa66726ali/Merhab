/** هل السياق آمن لاستخدام الكاميرا (HTTPS أو localhost). */
export function isCameraContextSecure(): boolean {
  if (typeof window === "undefined") return true;
  return window.isSecureContext;
}

/** استخراج public_token من رابط دعوة أو نص QR خام. */
export function extractGuestScanToken(raw: string): string {
  const t = raw.trim();
  const fromPath = t.match(/\/i\/([0-9a-f-]{36})/i);
  if (fromPath) return fromPath[1];
  const uuidOnly = t.match(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  );
  return uuidOnly ? t : t;
}

export const CAMERA_INSECURE_MSG =
  "المتصفّح لا يفتح الكاميرا عبر HTTP من جهاز آخر — استخدم HTTPS أو سجّل الحضور يدوياً من القائمة أدناه.";
