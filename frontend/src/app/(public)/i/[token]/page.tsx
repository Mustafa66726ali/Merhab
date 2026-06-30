"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { publicInvitationAPI, type PublicInvitation, type PublicInvitationCoordinator } from "@/lib/api";

/**
 * صفحة الدعوة العامة — يفتحها الضيف عبر رابط فريد.
 * تصميم مطابق لقالب الدعوة (Digital Majlis) مع إزالة: الشريط العلوي،
 * الشريط السفلي (Invite/Timeline/Guest List/RSVP)، وزرّي البث المباشر ورفع الصور.
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
        <div className="flex flex-col items-center gap-4 py-32">
          <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-on-surface-variant text-sm">جارِ تحميل الدعوة...</p>
        </div>
      </Page>
    );
  }

  if (error || !data) {
    return (
      <Page>
        <div className="flex flex-col items-center gap-4 py-32 text-center">
          <span className="material-symbols-outlined text-6xl text-error">error</span>
          <p className="text-on-surface font-bold text-lg">{error || "الدعوة غير متاحة"}</p>
        </div>
      </Page>
    );
  }

  const { event, guest, schedules, group_members, coordinator, qr_url } = data;
  const status = guest.status;
  const seated = status === "seated";
  const attended = status === "attended";
  const confirmed = status === "confirmed";
  const declined = status === "declined";

  return (
    <Page>
      <main className="max-w-md mx-auto px-4 py-10 space-y-12">
        {/* Hero — صورة وخلفية مطابقة لقالب الدعوة */}
        <section className="relative h-[530px] flex flex-col items-center justify-center text-center space-y-6 overflow-hidden rounded-[2rem]">
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={event.cover_image || "/invitation-hero.jpg"}
              alt={event.title}
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          </div>
          <div className="relative z-10 space-y-4 px-6">
            <span className="uppercase tracking-[0.2em] text-primary font-bold text-xs">
              {event.platform_name || "دعوة خاصة"}
            </span>
            <h2 className="arabic-display text-4xl font-extrabold leading-tight text-on-surface">
              {event.invitation_title || event.title}
            </h2>
            <div className="w-12 h-1 bg-primary mx-auto rounded-full" />
            <p className="arabic-display text-2xl font-bold text-on-surface-variant">
              {guest.full_name}
            </p>
          </div>
        </section>

        {/* Description */}
        {(event.description || event.invitation_message) && (
          <section className="text-center px-4">
            <p className="arabic-display text-lg text-on-surface-variant leading-relaxed italic">
              {event.description || ""}
            </p>
          </section>
        )}

        {/* Details */}
        <section className="grid grid-cols-1 gap-4">
          <DetailCard icon="calendar_month" label="التاريخ" value={formatDate(event.date)} />
          <DetailCard
            icon="schedule"
            label="الوقت"
            value={event.time ? formatTime(event.time) : "—"}
          />
          <div className="bg-surface-container-high p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-5">
              <div className="bg-primary-container/20 p-4 rounded-xl">
                <span className="material-symbols-outlined text-primary text-3xl">location_on</span>
              </div>
              <div className="min-w-0">
                <h3 className="arabic-display text-sm text-on-surface-variant">الموقع</h3>
                <p className="arabic-display text-xl font-bold text-on-surface truncate">
                  {event.venue || "سيُعلن لاحقاً"}
                </p>
              </div>
            </div>
            {(event.venue || (event.latitude && event.longitude)) && (
              <a
                href={
                  event.latitude && event.longitude
                    ? `https://www.google.com/maps?q=${event.latitude},${event.longitude}`
                    : `https://www.google.com/maps/search/${encodeURIComponent(event.venue)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-surface-container-highest rounded-xl text-primary font-bold flex items-center justify-center gap-2 hover:bg-surface-bright transition-colors"
              >
                <span className="material-symbols-outlined">map</span>
                <span>عرض الخريطة</span>
              </a>
            )}
          </div>
        </section>

        {/* Section / Group */}
        {(guest.section_name || guest.group_name) && (
          <section className="grid grid-cols-2 gap-4">
            {guest.section_name && (
              <SoftCard icon="grid_view" title={guest.section_name} sub="القسم المخصّص لك" />
            )}
            {guest.group_name && (
              <SoftCard icon="group" title={guest.group_name} sub="مجموعتك" />
            )}
          </section>
        )}

        {/* RSVP */}
        <section className="bg-surface-container-high p-8 rounded-[2rem] space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 blur-[60px] rounded-full -translate-x-1/2 -translate-y-1/2" />
          {seated ? (
            <Banner tone="emerald" icon="event_seat" title="تم إجلاسك في مقعدك">
              تم إدراجك في مقعدك داخل القاعة — نتمنى لك أمسية سعيدة
            </Banner>
          ) : attended ? (
            <Banner tone="emerald" icon="check_circle" title="تم تسجيل حضورك">
              شكراً لحضورك — نتمنى لك وقتاً ممتعاً
            </Banner>
          ) : confirmed ? (
            <div className="space-y-4">
              <Banner tone="emerald" icon="task_alt" title="تم تأكيد حضورك">
                نتشرف بحضورك — احتفظ برمز الدخول أدناه
              </Banner>
              <button
                onClick={() => respond("decline")}
                disabled={acting !== null}
                className="w-full py-3 rounded-xl text-sm font-bold text-on-surface-variant bg-surface-container-highest hover:bg-surface-bright transition-colors disabled:opacity-50"
              >
                تغيير ردي إلى اعتذار
              </button>
            </div>
          ) : declined ? (
            <div className="space-y-4">
              <Banner tone="rose" icon="cancel" title="تم تسجيل اعتذارك">
                نأسف لعدم تمكنك من الحضور
              </Banner>
              <button
                onClick={() => respond("confirm")}
                disabled={acting !== null}
                className="w-full py-4 rounded-xl font-bold text-white active:scale-95 transition-transform disabled:opacity-50"
                style={{
                  backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #c8bfff 100%)",
                  boxShadow: "0px 10px 20px rgba(66,0,218,0.3)",
                }}
              >
                {acting === "confirm" ? "جارِ التأكيد..." : "بل سأحضر — تأكيد الحضور"}
              </button>
            </div>
          ) : (
            <>
              <div className="text-center space-y-2 relative">
                <h2 className="arabic-display text-2xl font-bold text-on-surface">
                  هل ستشرفنا بحضورك؟
                </h2>
                <p className="text-on-surface-variant text-sm">
                  نرجو تأكيد الحضور لضمان أفضل استقبال
                </p>
              </div>
              <div className="flex flex-col gap-4 relative">
                <button
                  onClick={() => respond("confirm")}
                  disabled={acting !== null}
                  className="w-full py-4 text-white rounded-xl font-bold active:scale-95 transition-transform disabled:opacity-50"
                  style={{
                    backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #c8bfff 100%)",
                    boxShadow: "0px 10px 20px rgba(66,0,218,0.3)",
                  }}
                >
                  {acting === "confirm" ? "جارِ التأكيد..." : "تأكيد الحضور"}
                </button>
                <button
                  onClick={() => respond("decline")}
                  disabled={acting !== null}
                  className="py-4 bg-surface-container-highest rounded-xl text-on-surface font-medium active:scale-95 transition-transform disabled:opacity-50"
                >
                  {acting === "decline" ? "جارِ الإرسال..." : "اعتذار"}
                </button>
              </div>
            </>
          )}
        </section>

        {/* QR */}
        <section
          className={`p-8 rounded-[2rem] text-center space-y-6 ${
            qr_url
              ? "bg-white"
              : "bg-surface-container-lowest border border-dashed border-outline-variant"
          }`}
        >
          {qr_url ? (
            <QrBlock qrUrl={qr_url} guestName={guest.full_name} eventTitle={event.title} />
          ) : (
            <>
              <p className="text-sm text-on-surface-variant arabic-display">
                سيظهر رمز الدخول (QR Code) الخاص بك هنا بعد تأكيد الحضور
              </p>
              <div className="w-48 h-48 mx-auto bg-surface-container-high rounded-2xl flex items-center justify-center relative">
                <span className="material-symbols-outlined text-outline text-6xl opacity-20">
                  qr_code_2
                </span>
                <span className="material-symbols-outlined text-primary text-3xl absolute">
                  lock
                </span>
              </div>
            </>
          )}
        </section>

        {/* Timeline */}
        {schedules.length > 0 && (
          <section className="space-y-6">
            <h3 className="arabic-display text-xl font-bold px-2 flex items-center gap-3 text-on-surface">
              <span className="w-2 h-8 bg-primary rounded-full" />
              برنامج الحفل
            </h3>
            <div className="relative">
              <div className="absolute top-0 right-[23px] bottom-0 w-0.5 bg-outline-variant/30" />
              {schedules.map((s, i) => (
                <div
                  key={i}
                  className={`relative pr-16 ${i === schedules.length - 1 ? "" : "pb-10"}`}
                >
                  <div className="absolute right-0 top-1 w-12 h-12 bg-surface-container-high rounded-full border-4 border-background z-10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-base">
                      celebration
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-primary tracking-widest" dir="ltr">
                      {formatTime(s.start_time)}
                    </span>
                    <h4 className="arabic-display font-bold text-lg text-on-surface">{s.title}</h4>
                    {s.description && (
                      <p className="text-sm text-on-surface-variant italic">{s.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Who's attending from your group */}
        {group_members.length > 0 && (
          <section className="bg-surface-container-low p-6 rounded-[2rem] space-y-5">
            <h3 className="arabic-display font-bold text-on-surface">من سيحضر من مجموعتك</h3>
            <div className="space-y-3">
              {group_members.map((m, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 bg-surface-container-high rounded-xl ${
                    m.going ? "" : "opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container text-xs font-bold">
                      {m.initials}
                    </div>
                    <span className="arabic-display font-medium text-on-surface">
                      {m.full_name}
                      {m.is_self && <span className="text-primary text-xs"> (أنت)</span>}
                    </span>
                  </div>
                  <span
                    className={`material-symbols-outlined ${
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

        {/* Greeting message */}
        <GreetingBox token={token} initial={guest.greeting} />

        {/* Coordinator inquiry */}
        {coordinator && (
          <CoordinatorInquiryBox token={token} coordinator={coordinator} />
        )}

        {/* Footer */}
        <footer className="text-center pt-6 pb-8 space-y-3">
          <h2 className="arabic-display text-2xl font-black gradient-text">مرحّاب</h2>
          <p className="text-sm text-on-surface-variant tracking-[0.3em] uppercase font-bold">
            حيث تبدأ الحفاوة
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <span className="w-2 h-2 rounded-full bg-primary/20" />
            <span className="w-2 h-2 rounded-full bg-primary/50" />
            <span className="w-2 h-2 rounded-full bg-primary/20" />
          </div>
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

function DetailCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-surface-container-high p-6 rounded-2xl flex items-center gap-5">
      <div className="bg-primary-container/20 p-4 rounded-xl shrink-0">
        <span className="material-symbols-outlined text-primary text-3xl">{icon}</span>
      </div>
      <div className="min-w-0">
        <h3 className="arabic-display text-sm text-on-surface-variant">{label}</h3>
        <p className="arabic-display text-xl font-bold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function SoftCard({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="bg-surface-container-low p-6 rounded-2xl text-center space-y-3">
      <div className="w-12 h-12 bg-secondary-container rounded-full mx-auto flex items-center justify-center">
        <span className="material-symbols-outlined text-secondary">{icon}</span>
      </div>
      <h3 className="arabic-display font-bold text-on-surface truncate">{title}</h3>
      <p className="text-xs text-on-surface-variant">{sub}</p>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "emerald" | "rose";
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
      : "border-[#e07a93]/40 bg-[#e07a93]/10 text-[#f4a6ba]";
  return (
    <div className={`rounded-2xl border px-4 py-4 text-center relative ${toneClass}`}>
      <span className="material-symbols-outlined text-3xl">{icon}</span>
      <p className="font-black text-base mt-1">{title}</p>
      <p className="text-xs opacity-90 mt-1">{children}</p>
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
    <section className="space-y-3">
      <label className="arabic-display font-bold px-2 block text-on-surface">
        كلمة تهنئة لأهل الحفل
      </label>
      <p className="text-xs text-on-surface-variant px-2">
        تُعرض في لوحة التحكم ضمن «تهنئات واستفسارات الضيوف»
      </p>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="اكتب مشاعرك هنا..."
          className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 pl-16 focus:ring-2 focus:ring-primary focus:border-primary text-on-surface arabic-display h-32 outline-none resize-none"
        />
        <button
          onClick={send}
          disabled={saving || !value.trim()}
          className="absolute bottom-4 left-4 bg-primary-container p-2.5 rounded-xl text-white disabled:opacity-50"
          title="إرسال"
        >
          <span className="material-symbols-outlined">{saved ? "check" : "send"}</span>
        </button>
      </div>
      {saved && value && (
        <p className="text-xs text-emerald-400 px-2">تم إرسال كلمتك — شكراً لك</p>
      )}
    </section>
  );
}

function CoordinatorInquiryBox({
  token,
  coordinator,
}: {
  token: string;
  coordinator: PublicInvitationCoordinator;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const send = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError("");
    try {
      await publicInvitationAPI.inquiry(token, value.trim());
      setSaved(true);
      setValue("");
    } catch {
      setError("تعذّر إرسال الاستفسار — حاول مرة أخرى");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-surface-container-highest p-6 rounded-[2rem] space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary">support_agent</span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="arabic-display font-bold text-on-surface">{coordinator.name}</h4>
          <p className="text-xs text-on-surface-variant mt-1">
            منسّق الحفل — اكتب استفسارك وسيصل مباشرة للمنسّق
          </p>
        </div>
        {coordinator.phone && (
          <div className="flex gap-2 shrink-0">
            {coordinator.whatsapp_url && (
              <a
                href={coordinator.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-[#25D366] text-white rounded-full flex items-center justify-center"
                title="واتساب"
              >
                <span className="material-symbols-outlined">chat</span>
              </a>
            )}
            <a
              href={`tel:${coordinator.phone}`}
              className="w-10 h-10 bg-primary-container text-white rounded-full flex items-center justify-center"
              title="اتصال"
            >
              <span className="material-symbols-outlined">call</span>
            </a>
          </div>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        placeholder="اكتب استفسارك هنا..."
        className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-4 focus:ring-2 focus:ring-primary focus:border-primary text-on-surface arabic-display h-28 outline-none resize-none"
      />
      {error && <p className="text-xs text-error px-1">{error}</p>}
      {saved && <p className="text-xs text-emerald-400 px-1">تم إرسال استفسارك للمنسّق — سيتواصل معك قريباً</p>}
      <button
        type="button"
        onClick={send}
        disabled={saving || !value.trim()}
        className="w-full py-3.5 rounded-xl font-bold text-white disabled:opacity-50"
        style={{
          backgroundImage: "linear-gradient(135deg, #5b2eff 0%, #7b52ff 100%)",
        }}
      >
        {saving ? "جارِ الإرسال..." : "إرسال للمنسّق"}
      </button>
    </section>
  );
}

function QrBlock({
  qrUrl,
  guestName,
  eventTitle,
}: {
  qrUrl: string;
  guestName: string;
  eventTitle: string;
}) {
  const [busy, setBusy] = useState(false);

  const fetchDataUrl = async (): Promise<string> => {
    const res = await fetch(qrUrl, { cache: "no-store" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  };

  const downloadPng = async () => {
    setBusy(true);
    try {
      const dataUrl = await fetchDataUrl();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `دعوة-${guestName}.png`;
      a.click();
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const dataUrl = await fetchDataUrl();
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      doc.setFontSize(16);
      doc.text(eventTitle, pageW / 2, 30, { align: "center" });
      doc.setFontSize(12);
      doc.text(guestName, pageW / 2, 40, { align: "center" });
      const size = 90;
      doc.addImage(dataUrl, "PNG", (pageW - size) / 2, 55, size, size);
      doc.setFontSize(10);
      doc.text("Show this code at the entrance", pageW / 2, 160, { align: "center" });
      doc.save(`دعوة-${guestName}.pdf`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <p className="text-[#1c1b28] text-sm font-bold mb-3">رمز الدخول الخاص بك</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="رمز الدخول" className="w-52 h-52 object-contain" />
      <p className="text-[#1c1b28] text-xs font-bold mt-2">{guestName}</p>
      <div className="grid grid-cols-2 gap-3 w-full mt-5">
        <button
          onClick={downloadPng}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold text-on-primary bg-primary-container text-white disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">image</span>
          تنزيل صورة
        </button>
        <button
          onClick={downloadPdf}
          disabled={busy}
          className="flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold text-[#1c1b28] bg-[#e8e6f0] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">picture_as_pdf</span>
          تنزيل PDF
        </button>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("ar-SA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(value: string): string {
  if (!value) return "";
  // قد تكون قيمة وقت (HH:MM:SS) أو تاريخاً ووقتاً كاملاً
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
