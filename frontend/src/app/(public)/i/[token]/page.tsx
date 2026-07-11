"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicInvitationAPI, type PublicInvitation } from "@/lib/api";
import { eventMapsUrl, formatEventLocation } from "@/lib/eventLocation";

/**
 * صفحة الدعوة العامة — يفتحها الضيف عبر رابط فريد.
 * الترتيب: غلاف → بيانات الحدث → تأكيد الحضور → مجموعة الضيف → رسالة لأهل المناسبة.
 */
export default function PublicInvitationPage() {
  const params = useParams();
  const token = String(params?.token || "");

  const [data, setData] = useState<PublicInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState<"confirm" | "decline" | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await publicInvitationAPI.get(token);
      setData(res.data);
    } catch {
      setError("تعذّر العثور على الدعوة — تأكد من صحة الرابط");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const respond = async (action: "confirm" | "decline") => {
    setActing(action);
    try {
      const res = await publicInvitationAPI.respond(token, action);
      setData(res.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("تعذّر تسجيل ردك — حاول مرة أخرى");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-3 py-24">
          <div className="w-9 h-9 rounded-full border-3 border-primary/30 border-t-primary animate-spin" />
          <p className="text-on-surface-variant text-xs">جارِ تحميل الدعوة...</p>
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-3 py-24 text-center px-4">
          <span className="material-symbols-outlined text-4xl text-error">error</span>
          <p className="text-on-surface font-bold text-sm">{error || "الدعوة غير متاحة"}</p>
        </div>
      </Page>
    );
  }

  const { event, guest, group_members } = data;
  const locationLabel = formatEventLocation(event);
  const mapsUrl = eventMapsUrl(event);
  const status = guest.status;
  const seated = status === "seated";
  const attended = status === "attended";
  const confirmed = status === "confirmed";
  const declined = status === "declined";

  return (
    <Page>
      <main className="max-w-md mx-auto px-3 sm:px-4 py-5 sm:py-6 space-y-4 sm:space-y-5">
        {/* 1 — غلاف الحدث */}
        <section className="relative h-[220px] sm:h-[260px] flex flex-col items-center justify-end text-center overflow-hidden rounded-2xl">
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.cover_image || "/invitation-hero.jpg"}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
          </div>
          <div className="relative z-10 space-y-1.5 px-4 pb-4 w-full">
            <span className="uppercase tracking-[0.18em] text-primary font-bold text-[10px]">
              {event.platform_name || "دعوة خاصة"}
            </span>
            <h1 className="arabic-display text-xl sm:text-2xl font-extrabold leading-snug text-on-surface">
              {event.invitation_title || event.title}
            </h1>
            <div className="w-8 h-0.5 bg-primary mx-auto rounded-full" />
            <p className="arabic-display text-sm font-bold text-on-surface-variant">
              {guest.full_name}
            </p>
          </div>
        </section>

        {/* 2 — بيانات الحدث */}
        <section className="bg-surface-container-high rounded-2xl p-3 sm:p-3.5 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <MetaChip icon="calendar_month" label="التاريخ" value={formatDate(event.date)} />
            <MetaChip
              icon="schedule"
              label="الوقت"
              value={event.time ? formatTime(event.time) : "—"}
            />
          </div>
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-container-lowest/60 px-3 py-2.5">
            <span className="material-symbols-outlined text-primary text-lg mt-0.5 shrink-0">
              location_on
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-on-surface-variant">الموقع</p>
              <p className="arabic-display text-sm font-bold text-on-surface break-words leading-snug">
                {locationLabel || "سيُعلن لاحقاً"}
              </p>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">map</span>
                خريطة
              </a>
            )}
          </div>
        </section>

        {/* 3 — تأكيد الحضور */}
        {!seated && !attended && (
          <section className="bg-surface-container-high p-3.5 sm:p-4 rounded-2xl space-y-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-24 h-24 bg-primary/10 blur-[48px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            {confirmed ? (
              <div className="relative">
                <button
                  onClick={() => respond("decline")}
                  disabled={acting !== null}
                  className="w-full py-2 rounded-xl text-xs font-bold text-on-surface-variant bg-surface-container-highest hover:bg-surface-bright transition-colors disabled:opacity-50"
                >
                  تغيير ردي إلى اعتذار
                </button>
              </div>
            ) : declined ? (
              <div className="relative">
                <button
                  onClick={() => respond("confirm")}
                  disabled={acting !== null}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #c8bfff 100%)",
                    boxShadow: "0px 8px 16px rgba(66,0,218,0.25)",
                  }}
                >
                  {acting === "confirm" ? "جارِ التأكيد..." : "بل سأحضر — تأكيد الحضور"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 relative">
                <div className="text-center space-y-0.5">
                  <h2 className="arabic-display text-base font-bold text-on-surface">
                    هل ستشرفنا بحضورك؟
                  </h2>
                  <p className="text-on-surface-variant text-[11px]">
                    نرجو تأكيد الحضور لضمان أفضل استقبال
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => respond("confirm")}
                    disabled={acting !== null}
                    className="w-full py-2.5 text-sm text-white rounded-xl font-bold active:scale-[0.98] transition-transform disabled:opacity-50"
                    style={{
                      backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #c8bfff 100%)",
                      boxShadow: "0px 8px 16px rgba(66,0,218,0.25)",
                    }}
                  >
                    {acting === "confirm" ? "جارِ التأكيد..." : "تأكيد الحضور"}
                  </button>
                  <button
                    onClick={() => respond("decline")}
                    disabled={acting !== null}
                    className="py-2 rounded-xl text-xs bg-surface-container-highest text-on-surface font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {acting === "decline" ? "جارِ الإرسال..." : "اعتذار"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 4 — من سيحضر من مجموعتك */}
        {group_members.length > 0 && (
          <section className="bg-surface-container-low p-3 sm:p-3.5 rounded-2xl space-y-2.5">
            <h3 className="arabic-display text-sm font-bold text-on-surface px-0.5">
              من سيحضر من مجموعتك
            </h3>
            <div className="space-y-1.5">
              {group_members.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-2.5 py-2 bg-surface-container-high rounded-xl ${
                    m.going ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-[10px] font-bold shrink-0">
                      {m.initials}
                    </div>
                    <span className="arabic-display text-xs font-medium text-on-surface truncate">
                      {m.full_name}
                      {m.is_self && <span className="text-primary text-[10px]"> (أنت)</span>}
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-base shrink-0 ${
                      m.going
                        ? "text-emerald-400"
                        : m.declined
                          ? "text-error"
                          : "text-outline"
                    }`}
                    style={m.going ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {m.going ? "check_circle" : m.declined ? "cancel" : "help"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5 — رسالة لأهل المناسبة */}
        <GreetingBox token={token} initial={guest.greeting} />

        <footer className="text-center pt-2 pb-4 space-y-1.5">
          <h2 className="arabic-display text-base font-black gradient-text">مرحّاب</h2>
          <p className="text-[10px] text-on-surface-variant tracking-[0.25em] uppercase font-bold">
            حيث تبدأ الحفاوة
          </p>
        </footer>
      </main>
    </Page>
  );
}

/* ===================== مكوّنات مساعدة ===================== */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-on-surface overflow-x-hidden">
      {children}
    </div>
  );
}

function MetaChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-surface-container-lowest/60 px-2.5 py-2">
      <span className="material-symbols-outlined text-primary text-base mt-0.5 shrink-0">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-on-surface-variant">{label}</p>
        <p className="arabic-display text-xs font-bold text-on-surface leading-snug">{value}</p>
      </div>
    </div>
  );
}

function GreetingBox({ token, initial }: { token: string; initial: string }) {
  const [value, setValue] = useState(initial || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!initial);

  const send = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await publicInvitationAPI.greeting(token, value.trim());
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-1.5">
      <label className="arabic-display text-sm font-bold px-0.5 block text-on-surface">
        رسالة لأهل المناسبة
      </label>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="اكتب كلمتك هنا..."
          rows={3}
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 pl-12 text-sm focus:ring-2 focus:ring-primary focus:border-primary text-on-surface arabic-display outline-none resize-none"
        />
        <button
          onClick={send}
          disabled={saving || !value.trim()}
          className="absolute bottom-2.5 left-2.5 bg-primary-container p-2 rounded-lg text-white disabled:opacity-50"
          title="إرسال"
        >
          <span className="material-symbols-outlined text-base">{saved ? "check" : "send"}</span>
        </button>
      </div>
      {saved && value && (
        <p className="text-[11px] text-emerald-400 px-0.5">تم إرسال كلمتك — شكراً لك</p>
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(value: string): string {
  if (!value) return "";
  const d = value.includes("T") || value.includes(" ") ? new Date(value) : null;
  try {
    if (d && !isNaN(d.getTime())) {
      return d.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" });
    }
    const [h, m] = value.split(":");
    const dt = new Date();
    dt.setHours(Number(h), Number(m));
    return dt.toLocaleTimeString("ar-SA", { hour: "numeric", minute: "2-digit" });
  } catch {
    return value;
  }
}
