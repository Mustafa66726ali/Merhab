"use client";

import { useCallback, useEffect, useState } from "react";
import ToggleSwitch from "@/components/common/ToggleSwitch";
import PlatformLogoPicker from "@/components/platform-panel/PlatformLogoPicker";
import { platformsAPI, type PlatformMySettings } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import {
  buildPhoneE164,
  buildWaMeLink,
  DEFAULT_PHONE_COUNTRY_CODE,
  filterCountries,
  getCountryByCode,
  parsePhoneE164,
} from "@/lib/phoneCountries";

type CountryFilter = "arab" | "all";

function fieldInput(className = "") {
  return `w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl py-3 px-4 text-on-surface text-sm focus:ring-2 focus:ring-primary-container/40 focus:border-primary-container/50 transition-all outline-none ${className}`;
}

function statusBadgeClass(status: string) {
  return status === "active"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";
}

export default function PlatformSettingsView() {
  const setPlatform = useAuthStore((s) => s.setPlatform);
  const [settings, setSettings] = useState<PlatformMySettings | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [whatsappNational, setWhatsappNational] = useState("");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("arab");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [clearLogo, setClearLogo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await platformsAPI.mySettings();
      const d = res.data;
      setSettings(d);
      setName(d.name);
      setDescription(d.description ?? "");
      const parsed = parsePhoneE164(d.whatsapp_number);
      setDialCode(parsed.dialCode);
      setWhatsappNational(parsed.national);
      setWhatsappEnabled(d.whatsapp_invites_enabled);
      setLogoFile(null);
      setClearLogo(false);
      setPlatform({
        id: d.id,
        name: d.name,
        logo_url: d.logo_url,
      });
      localStorage.setItem(
        "platform_info",
        JSON.stringify({ id: d.id, name: d.name, logo_url: d.logo_url })
      );
    } catch {
      setError("تعذّر تحميل إعدادات المنصة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selectedCountry = getCountryByCode(dialCode);
  const countryOptions = filterCountries(countryFilter);
  const previewLink = buildWaMeLink(buildPhoneE164(dialCode, whatsappNational));

  const applyParsedFromServer = (e164: string) => {
    const parsed = parsePhoneE164(e164);
    setDialCode(parsed.dialCode);
    setWhatsappNational(parsed.national);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    const fullNumber = buildPhoneE164(dialCode, whatsappNational);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      form.append("whatsapp_number", fullNumber);
      form.append("whatsapp_invites_enabled", String(whatsappEnabled));
      if (logoFile) form.append("logo", logoFile);
      if (clearLogo) form.append("clear_logo", "true");

      const res = await platformsAPI.mySettingsUpdate(form);
      setSettings(res.data);
      applyParsedFromServer(res.data.whatsapp_number);
      setWhatsappEnabled(res.data.whatsapp_invites_enabled);
      setLogoFile(null);
      setClearLogo(false);
      setPlatform({
        id: res.data.id,
        name: res.data.name,
        logo_url: res.data.logo_url,
      });
      localStorage.setItem(
        "platform_info",
        JSON.stringify({
          id: res.data.id,
          name: res.data.name,
          logo_url: res.data.logo_url,
        })
      );
      setSuccess("تم حفظ الإعدادات بنجاح");
    } catch (err: unknown) {
      const detail =
        err &&
        typeof err === "object" &&
        "response" in err &&
        err.response &&
        typeof err.response === "object" &&
        "data" in err.response
          ? err.response.data
          : null;
      if (detail && typeof detail === "object") {
        const first = Object.values(detail).flat()[0];
        setError(typeof first === "string" ? first : "فشل حفظ الإعدادات");
      } else {
        setError("فشل حفظ الإعدادات — تحقق من الحقول");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <span className="animate-spin w-10 h-10 border-4 border-primary-container border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!settings && error) {
    return (
      <div className="px-4 py-16 text-center text-on-surface-variant">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-container/20">
          <span className="material-symbols-outlined text-primary text-xl">settings</span>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-on-surface font-headline">
            إعدادات المنصة
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            إدارة بيانات منصتك وربط واتساب لإرسال دعوات الفعاليات
          </p>
        </div>
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm px-4 py-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {success}
        </p>
      )}

      {/* معلومات المنصة */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 space-y-5">
        <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">dns</span>
          معلومات المنصة
        </h2>

        <PlatformLogoPicker
          initialUrl={settings?.logo_url}
          cleared={clearLogo}
          disabled={saving}
          onChange={(file) => {
            setLogoFile(file);
            setClearLogo(false);
          }}
          onClear={() => {
            setLogoFile(null);
            setClearLogo(true);
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1.5 block">
            <span className="text-xs font-bold text-on-surface-variant">اسم المنصة</span>
            <input
              className={fieldInput()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم منصتك"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-on-surface-variant">حالة المنصة</span>
            <div className="py-3 px-4 rounded-xl bg-surface-container-high border border-outline-variant/10">
              <span
                className={`inline-flex px-2.5 py-0.5 text-xs font-bold rounded-full border ${statusBadgeClass(settings?.status ?? "active")}`}
              >
                {settings?.status_label ?? "—"}
              </span>
            </div>
          </div>
        </div>

        <label className="space-y-1.5 block">
          <span className="text-xs font-bold text-on-surface-variant">وصف المنصة</span>
          <textarea
            className={fieldInput("min-h-[88px] resize-y")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف مختصر عن منصتك ونوع الفعاليات..."
          />
        </label>

        <div className="text-xs text-on-surface-variant border-t border-outline-variant/10 pt-4 space-y-1">
          <p>مالك المنصة: <span className="text-on-surface">{settings?.owner_name}</span></p>
          <p dir="ltr" className="text-outline">{settings?.owner_email}</p>
        </div>
      </section>

      {/* واتساب الدعوات */}
      <section className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-5 sm:p-6 space-y-5 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400">chat</span>
                واتساب الدعوات
              </h2>
              <p className="text-sm text-on-surface-variant mt-1 max-w-xl">
                أضف رقم واتساب العمل الذي ستُرسل منه دعوات الفعاليات للضيوف. يُفضّل استخدام
                رقم واتساب بيزنس مرتبط بمنصتك.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-bold text-on-surface-variant">
                تفعيل إرسال الدعوات
              </span>
              <ToggleSwitch
                checked={whatsappEnabled}
                onChange={setWhatsappEnabled}
                label="تفعيل إرسال الدعوات عبر واتساب"
              />
            </div>
          </div>

          <label className="space-y-2 block">
            <span className="text-xs font-bold text-on-surface-variant">رقم واتساب</span>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCountryFilter("arab")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  countryFilter === "arab"
                    ? "border-primary-container/50 bg-primary-container/15 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant"
                }`}
              >
                الدول العربية ({filterCountries("arab").length})
              </button>
              <button
                type="button"
                onClick={() => setCountryFilter("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  countryFilter === "all"
                    ? "border-primary-container/50 bg-primary-container/15 text-primary"
                    : "border-outline-variant/20 text-on-surface-variant"
                }`}
              >
                جميع الدول ({filterCountries("all").length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                className={`${fieldInput()} sm:max-w-[220px] shrink-0`}
                dir="ltr"
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                disabled={!whatsappEnabled}
              >
                {countryOptions.map((c) => (
                  <option key={c.code} value={c.code}>
                    +{c.code} — {c.nameAr}
                  </option>
                ))}
                {countryFilter === "arab" &&
                  !countryOptions.some((c) => c.code === dialCode) && (
                    <option value={dialCode}>
                      +{dialCode} — {selectedCountry?.nameAr ?? "مختار"}
                    </option>
                  )}
              </select>
              <input
                className={fieldInput("flex-1")}
                dir="ltr"
                type="tel"
                value={whatsappNational}
                onChange={(e) => setWhatsappNational(e.target.value.replace(/[^\d\s-]/g, ""))}
                placeholder={selectedCountry?.placeholder ?? "رقم الهاتف"}
                disabled={!whatsappEnabled}
              />
            </div>
            <p className="text-[11px] text-outline">
              اختر الدولة ثم أدخل الرقم بدون رمز الدولة — يُحفظ بصيغة دولية E.164
              {buildPhoneE164(dialCode, whatsappNational) && (
                <span className="text-on-surface-variant" dir="ltr">
                  {" "}
                  ({buildPhoneE164(dialCode, whatsappNational)})
                </span>
              )}
            </p>
          </label>

          {previewLink && whatsappEnabled && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-emerald-400 mb-1">معاينة الرابط</p>
                <p className="text-sm text-on-surface-variant truncate" dir="ltr">
                  {previewLink}
                </p>
              </div>
              <a
                href={previewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
                اختبار واتساب
              </a>
            </div>
          )}

          <ul className="text-[11px] text-on-surface-variant space-y-2 list-none">
            <li className="flex gap-2">
              <span className="material-symbols-outlined text-emerald-400 text-sm shrink-0">info</span>
              سيُستخدم هذا الرقم كمصدر رسائل الدعوات عند إرسالها للضيوف.
            </li>
            <li className="flex gap-2">
              <span className="material-symbols-outlined text-amber-400 text-sm shrink-0">warning</span>
              تأكد أن الرقم مفعّل على واتساب ويمكنه استقبال الرسائل.
            </li>
          </ul>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          type="button"
          onClick={load}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-sm font-bold border border-outline-variant/25 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
        >
          إعادة التحميل
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="inline-flex items-center justify-center gap-2 bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
        </button>
      </div>
    </div>
  );
}
