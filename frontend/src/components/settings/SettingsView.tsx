"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import ToggleSwitch from "@/components/settings/ToggleSwitch";
import {
  authAPI,
  systemSettingsAPI,
  type SystemSettings,
  type SystemSettingsChoice,
} from "@/lib/api";
import { useAuthStore } from "@/lib/store";

type TabId = "general" | "notifications" | "events" | "security";

const TABS: { id: TabId; label: string }[] = [
  { id: "general", label: "عام" },
  { id: "notifications", label: "التنبيهات" },
  { id: "events", label: "إعدادات الفعاليات" },
  { id: "security", label: "الأمان" },
];

const defaultChoices = {
  languages: [] as SystemSettingsChoice[],
  timezones: [] as SystemSettingsChoice[],
  qr_validity: [] as SystemSettingsChoice[],
  ticket_formats: [] as SystemSettingsChoice[],
};

function glassCard(className = "") {
  return `rounded-2xl border border-outline-variant/10 bg-surface-container-low/80 backdrop-blur-sm ${className}`;
}

function fieldInput(className = "") {
  return `w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:ring-2 focus:ring-primary-container/40 focus:border-primary-container/50 transition-all outline-none ${className}`;
}

export default function SettingsView() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [platformName, setPlatformName] = useState("مرحّاب");
  const [defaultLanguage, setDefaultLanguage] = useState("ar_SA");
  const [timezone, setTimezone] = useState("Asia/Riyadh");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(false);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifySystemAlerts, setNotifySystemAlerts] = useState(true);

  const [qrValidity, setQrValidity] = useState("48h");
  const [rsvpAuto, setRsvpAuto] = useState(true);
  const [highResHeaders, setHighResHeaders] = useState(false);
  const [ticketFormat, setTicketFormat] = useState("digital");

  const [choices, setChoices] = useState(defaultChoices);

  const [twoFactor, setTwoFactor] = useState(false);
  const [twoFactorSaving, setTwoFactorSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Record<TabId, HTMLElement | null>>({
    general: null,
    notifications: null,
    events: null,
    security: null,
  });

  const applySettings = useCallback((data: SystemSettings) => {
    setPlatformName(data.platform_name);
    setDefaultLanguage(data.default_language);
    setTimezone(data.timezone);
    setLogoUrl(data.logo_url);
    setNotifyEmail(data.notify_email);
    setNotifySms(data.notify_sms);
    setNotifyWhatsapp(data.notify_whatsapp);
    setNotifyPush(data.notify_push);
    setNotifySystemAlerts(data.notify_system_alerts);
    setQrValidity(data.qr_validity);
    setRsvpAuto(data.rsvp_auto_enabled);
    setHighResHeaders(data.high_res_headers_only);
    setTicketFormat(data.ticket_format);
    if (data.choices) setChoices(data.choices);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await systemSettingsAPI.get();
        if (!cancelled) {
          applySettings(res.data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("تعذر تحميل الإعدادات");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applySettings]);

  useEffect(() => {
    if (user?.two_factor_enabled !== undefined) {
      setTwoFactor(user.two_factor_enabled);
    }
  }, [user?.two_factor_enabled]);

  const scrollToTab = (tab: TabId) => {
    setActiveTab(tab);
    const el = sectionRefs.current[tab];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      let res;
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        fd.append("platform_name", platformName);
        fd.append("default_language", defaultLanguage);
        fd.append("timezone", timezone);
        fd.append("notify_email", String(notifyEmail));
        fd.append("notify_sms", String(notifySms));
        fd.append("notify_whatsapp", String(notifyWhatsapp));
        fd.append("notify_push", String(notifyPush));
        fd.append("notify_system_alerts", String(notifySystemAlerts));
        fd.append("qr_validity", qrValidity);
        fd.append("rsvp_auto_enabled", String(rsvpAuto));
        fd.append("high_res_headers_only", String(highResHeaders));
        fd.append("ticket_format", ticketFormat);
        res = await systemSettingsAPI.update(fd);
      } else {
        res = await systemSettingsAPI.update({
          platform_name: platformName,
          default_language: defaultLanguage,
          timezone,
          notify_email: notifyEmail,
          notify_sms: notifySms,
          notify_whatsapp: notifyWhatsapp,
          notify_push: notifyPush,
          notify_system_alerts: notifySystemAlerts,
          qr_validity: qrValidity,
          rsvp_auto_enabled: rsvpAuto,
          high_res_headers_only: highResHeaders,
          ticket_format: ticketFormat,
        });
      }
      applySettings(res.data);
      setLogoFile(null);
      setLogoPreview(null);
      setMessage("تم حفظ الإعدادات بنجاح");
    } catch {
      setError("فشل حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const handleTwoFactor = async (enabled: boolean) => {
    setTwoFactorSaving(true);
    setTwoFactor(enabled);
    try {
      const res = await authAPI.setTwoFactor(enabled);
      setUser(res.data);
      setMessage(enabled ? "تم تفعيل المصادقة الثنائية" : "تم إيقاف المصادقة الثنائية");
    } catch {
      setTwoFactor(!enabled);
      setError("فشل تحديث المصادقة الثنائية");
    } finally {
      setTwoFactorSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  const displayLogo = logoPreview || logoUrl;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl mx-auto">
      {/* Page header + tabs */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-[#0d0d18]/90 backdrop-blur-xl border-b border-outline-variant/10 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface">الإعدادات</h1>
            <p className="text-sm text-on-surface-variant mt-1">
              تخصيص المنصة، الإشعارات، الفعاليات، والأمان
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-6 py-2.5 rounded-2xl font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-primary-container/20 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
        <nav className="flex gap-1 sm:gap-4 mt-4 overflow-x-auto pb-1 scrollbar-thin">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => scrollToTab(tab.id)}
              className={`shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.id
                  ? "text-primary bg-primary-container/10 border-b-2 border-primary-container"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {(message || error) && (
        <div
          className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${
            error
              ? "bg-red-500/10 text-red-400 border-red-500/30"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          }`}
        >
          {error || message}
        </div>
      )}

      <div className="space-y-10 lg:space-y-14">
        {/* General */}
        <section ref={(el) => { sectionRefs.current.general = el; }}>
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight mb-2">
              إعدادات المنصة
            </h2>
            <p className="text-on-surface-variant text-sm">
              قم بتخصيص الهوية البصرية والخصائص الأساسية لمنصة مرحّاب
            </p>
          </div>

          <div className={`${glassCard()} p-6 sm:p-8`}>
            <div className="flex flex-col sm:flex-row items-start gap-6 sm:gap-8">
                <div className="space-y-3 shrink-0">
                  <label className="block text-xs font-bold text-primary tracking-widest uppercase">
                    شعار المنصة
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group cursor-pointer block"
                  >
                    <div
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-surface-container-highest border-2 border-dashed border-outline-variant/40 flex flex-col items-center justify-center transition-all group-hover:border-primary-container/50 group-hover:bg-primary-container/5 overflow-hidden"
                    >
                      {displayLogo ? (
                        <img
                          src={displayLogo}
                          alt="شعار المنصة"
                          className="w-full h-full object-contain p-2"
                        />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-outline text-3xl mb-1">
                            add_a_photo
                          </span>
                          <span className="text-[10px] text-outline-variant font-bold">
                            تحديث الشعار
                          </span>
                        </>
                      )}
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-primary-container p-2 rounded-xl shadow-xl shadow-primary-container/30">
                      <span className="material-symbols-outlined text-on-primary-container text-sm">
                        edit
                      </span>
                    </div>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                  />
                  <p className="text-[10px] text-on-surface-variant max-w-[160px] leading-relaxed">
                    يفضل استخدام صيغة PNG أو SVG بخلفية شفافة
                  </p>
                </div>

                <div className="flex-1 space-y-5 min-w-0">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface">
                      اسم المنصة
                    </label>
                    <input
                      type="text"
                      className={fieldInput()}
                      value={platformName}
                      onChange={(e) => setPlatformName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-on-surface">
                        اللغة الافتراضية
                      </label>
                      <select
                        className={fieldInput()}
                        value={defaultLanguage}
                        onChange={(e) => setDefaultLanguage(e.target.value)}
                      >
                        {choices.languages.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-on-surface">
                        المنطقة الزمنية
                      </label>
                      <select
                        className={fieldInput()}
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        {choices.timezones.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </section>

        {/* Notifications */}
        <section ref={(el) => { sectionRefs.current.notifications = el; }}>
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary p-2 bg-primary-container/10 rounded-lg">
              notifications_active
            </span>
            <h2 className="text-xl font-bold">إعدادات الإشعارات والتواصل</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                key: "email",
                icon: "mail",
                title: "البريد الإلكتروني",
                subtitle: "إشعارات SMTP والبريد",
                iconClass: "bg-purple-500/10 text-purple-400",
                checked: notifyEmail,
                onChange: setNotifyEmail,
              },
              {
                key: "sms",
                icon: "sms",
                title: "رسائل SMS",
                subtitle: "بوابة الرسائل النصية",
                iconClass: "bg-blue-500/10 text-blue-400",
                checked: notifySms,
                onChange: setNotifySms,
              },
              {
                key: "whatsapp",
                icon: "chat",
                title: "واتساب",
                subtitle: "WhatsApp Business",
                iconClass: "bg-emerald-500/10 text-emerald-400",
                checked: notifyWhatsapp,
                onChange: setNotifyWhatsapp,
              },
              {
                key: "push",
                icon: "notifications",
                title: "إشعارات التطبيق",
                subtitle: "Push notifications",
                iconClass: "bg-primary-container/10 text-primary",
                checked: notifyPush,
                onChange: setNotifyPush,
              },
              {
                key: "system",
                icon: "warning",
                title: "تنبيهات النظام",
                subtitle: "أخطاء وصيانة النظام",
                iconClass: "bg-amber-500/10 text-amber-400",
                checked: notifySystemAlerts,
                onChange: setNotifySystemAlerts,
              },
            ].map((item) => (
              <div
                key={item.key}
                className={`${glassCard()} p-5 sm:p-6 transition-all hover:-translate-y-0.5`}
              >
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.iconClass}`}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {item.icon}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm sm:text-base">{item.title}</h3>
                      <span className="text-[10px] text-on-surface-variant font-bold uppercase">
                        {item.subtitle}
                      </span>
                    </div>
                  </div>
                  <ToggleSwitch checked={item.checked} onChange={item.onChange} />
                </div>
                <p className="text-xs text-on-surface-variant">
                  {item.checked ? "مفعّل — سيتم إرسال الإشعارات عبر هذا القناة" : "معطّل — لن يتم الإرسال"}
                </p>
              </div>
            ))}
          </div>

          <div className={`${glassCard()} p-4 sm:p-5 mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">hub</span>
              <div>
                <p className="font-bold text-sm">إعدادات التكاملات</p>
                <p className="text-xs text-on-surface-variant">
                  ربط SMTP، SMS، وواتساب من صفحة التكاملات
                </p>
              </div>
            </div>
            <Link
              href="/integrations"
              className="inline-flex items-center justify-center gap-1 text-sm font-bold text-primary hover:underline shrink-0"
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              فتح التكاملات
            </Link>
          </div>
        </section>

        {/* Events defaults */}
        <section ref={(el) => { sectionRefs.current.events = el; }}>
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-primary p-2 bg-primary-container/10 rounded-lg">
              qr_code_2
            </span>
            <h2 className="text-xl font-bold">إعدادات الفعاليات الافتراضية</h2>
          </div>

          <div className={`${glassCard()} p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8`}>
            <div className="space-y-3">
              <label className="block text-sm font-semibold">مدة صلاحية رمز QR</label>
              <select
                className={fieldInput("py-2.5")}
                value={qrValidity}
                onChange={(e) => setQrValidity(e.target.value)}
              >
                {choices.qr_validity.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold">نظام RSVP</label>
              <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                <span className="text-xs">تفعيل تلقائي</span>
                <ToggleSwitch checked={rsvpAuto} onChange={setRsvpAuto} size="sm" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold">صور الترويسة</label>
              <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-xl border border-outline-variant/10">
                <span className="text-xs">دقة عالية فقط</span>
                <ToggleSwitch checked={highResHeaders} onChange={setHighResHeaders} size="sm" />
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold">تنسيق التذاكر</label>
              <select
                className={fieldInput("py-2.5")}
                value={ticketFormat}
                onChange={(e) => setTicketFormat(e.target.value)}
              >
                {choices.ticket_formats.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Security */}
        <section ref={(el) => { sectionRefs.current.security = el; }} className="pb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-tertiary p-2 bg-tertiary/10 rounded-lg">
              security
            </span>
            <h2 className="text-xl font-bold">الأمان وحماية البيانات</h2>
          </div>

          <div className={`${glassCard()} p-6 sm:p-8 space-y-8`}>
            <div className="p-5 sm:p-6 rounded-2xl bg-primary-container/5 border border-primary-container/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    security_update_good
                  </span>
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="font-bold">المصادقة الثنائية (2FA)</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    إضافة طبقة حماية إضافية لحسابك باستخدام تطبيقات المصادقة مثل Google
                    Authenticator
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={twoFactor}
                onChange={handleTwoFactor}
                disabled={twoFactorSaving}
                size="lg"
              />
            </div>

            <Link
              href="/activity-logs"
              className="flex items-center justify-center gap-2 w-full py-3 bg-surface-container-highest text-on-surface-variant font-bold rounded-xl hover:bg-error/10 hover:text-error transition-all border border-outline-variant/20"
            >
              <span className="material-symbols-outlined">history</span>
              سجل الدخول والنشاطات الأخيرة
            </Link>
          </div>
        </section>
      </div>

      {/* Mobile sticky save */}
      <div className="fixed bottom-4 left-4 right-4 sm:hidden z-30">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-primary-container text-on-primary-container py-3.5 rounded-2xl font-bold shadow-2xl shadow-primary-container/30 disabled:opacity-60"
        >
          <span className="material-symbols-outlined">save</span>
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}
