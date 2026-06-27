"use client";

import { useEffect, useState } from "react";

export interface PhoneCountry {
  code: string;
  dial: string;
  label: string;
  flag: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "SA", dial: "+966", label: "السعودية", flag: "🇸🇦" },
  { code: "AE", dial: "+971", label: "الإمارات", flag: "🇦🇪" },
  { code: "KW", dial: "+965", label: "الكويت", flag: "🇰🇼" },
  { code: "QA", dial: "+974", label: "قطر", flag: "🇶🇦" },
  { code: "BH", dial: "+973", label: "البحرين", flag: "🇧🇭" },
  { code: "OM", dial: "+968", label: "عُمان", flag: "🇴🇲" },
  { code: "EG", dial: "+20", label: "مصر", flag: "🇪🇬" },
  { code: "JO", dial: "+962", label: "الأردن", flag: "🇯🇴" },
  { code: "LB", dial: "+961", label: "لبنان", flag: "🇱🇧" },
  { code: "SY", dial: "+963", label: "سوريا", flag: "🇸🇾" },
  { code: "IQ", dial: "+964", label: "العراق", flag: "🇮🇶" },
  { code: "YE", dial: "+967", label: "اليمن", flag: "🇾🇪" },
  { code: "MA", dial: "+212", label: "المغرب", flag: "🇲🇦" },
  { code: "TN", dial: "+216", label: "تونس", flag: "🇹🇳" },
  { code: "LY", dial: "+218", label: "ليبيا", flag: "🇱🇾" },
  { code: "SD", dial: "+249", label: "السودان", flag: "🇸🇩" },
  { code: "PS", dial: "+970", label: "فلسطين", flag: "🇵🇸" },
  { code: "US", dial: "+1", label: "الولايات المتحدة", flag: "🇺🇸" },
  { code: "GB", dial: "+44", label: "بريطانيا", flag: "🇬🇧" },
  { code: "FR", dial: "+33", label: "فرنسا", flag: "🇫🇷" },
  { code: "DE", dial: "+49", label: "ألمانيا", flag: "🇩🇪" },
  { code: "TR", dial: "+90", label: "تركيا", flag: "🇹🇷" },
  { code: "IN", dial: "+91", label: "الهند", flag: "🇮🇳" },
];

const DEFAULT_COUNTRY = PHONE_COUNTRIES[0];

export interface ParsedPhoneValue {
  country: PhoneCountry;
  dial: string;
  local: string;
  isManualDial: boolean;
}

function normalizeDial(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed.startsWith("+") ? "+" : "";
  return `+${digits}`;
}

export function parsePhoneValue(value: string): ParsedPhoneValue {
  const raw = (value || "").trim();
  if (!raw) {
    return {
      country: DEFAULT_COUNTRY,
      dial: DEFAULT_COUNTRY.dial,
      local: "",
      isManualDial: false,
    };
  }

  const normalized = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

  for (const country of sorted) {
    if (normalized.startsWith(country.dial)) {
      return {
        country,
        dial: country.dial,
        local: normalized.slice(country.dial.length).replace(/\D/g, ""),
        isManualDial: false,
      };
    }
  }

  const customMatch = normalized.match(/^(\+\d{1,6})(\d*)$/);
  if (customMatch) {
    const dial = customMatch[1];
    const local = customMatch[2];
    const matched = PHONE_COUNTRIES.find((c) => c.dial === dial);
    return {
      country: matched ?? DEFAULT_COUNTRY,
      dial,
      local,
      isManualDial: !matched,
    };
  }

  return {
    country: DEFAULT_COUNTRY,
    dial: DEFAULT_COUNTRY.dial,
    local: raw.replace(/\D/g, ""),
    isManualDial: false,
  };
}

export function buildPhoneValue(country: PhoneCountry, local: string) {
  return buildPhoneValueFromDial(country.dial, local);
}

export function buildPhoneValueFromDial(dial: string, local: string) {
  const dialNorm = normalizeDial(dial);
  const digits = local.replace(/\D/g, "");
  if (!dialNorm && !digits) return "";
  if (!digits) return dialNorm;
  if (!dialNorm || dialNorm === "+") return digits;
  return `${dialNorm}${digits}`;
}

function extractDialFromFullValue(value: string, local: string) {
  const raw = (value || "").trim();
  if (!raw || !local) return normalizeDial(raw);
  const normalized = raw.startsWith("+") ? raw : `+${raw.replace(/\D/g, "")}`;
  const localDigits = local.replace(/\D/g, "");
  if (normalized.endsWith(localDigits)) {
    return normalized.slice(0, normalized.length - localDigits.length) || "+";
  }
  return normalizeDial(raw);
}

type DialInputMode = "country" | "manual";

interface PhoneNumberFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function PhoneNumberField({
  value,
  onChange,
  disabled = false,
  placeholder = "5xxxxxxxx",
}: PhoneNumberFieldProps) {
  const parsed = parsePhoneValue(value);
  const [inputMode, setInputMode] = useState<DialInputMode>(
    parsed.isManualDial ? "manual" : "country"
  );
  const [manualDial, setManualDial] = useState(
    parsed.isManualDial ? extractDialFromFullValue(value, parsed.local) : parsed.dial
  );

  useEffect(() => {
    const next = parsePhoneValue(value);
    if (next.isManualDial) {
      setInputMode("manual");
      setManualDial(extractDialFromFullValue(value, next.local));
    }
  }, [value]);

  const { country, local } = parsed;

  const handleModeChange = (mode: DialInputMode) => {
    setInputMode(mode);
    if (mode === "country") {
      onChange(buildPhoneValue(country, local));
    } else {
      const nextDial = country.dial;
      setManualDial(nextDial);
      onChange(buildPhoneValueFromDial(nextDial, local));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 bg-surface-container-high rounded-lg border border-outline-variant/10">
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange("country")}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
            inputMode === "country"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          اختيار الدولة
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => handleModeChange("manual")}
          className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
            inputMode === "manual"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          مفتاح يدوي
        </button>
      </div>

      <div className="flex gap-2">
        {inputMode === "country" ? (
          <div className="relative shrink-0 w-[min(42%,160px)] sm:w-[150px]">
            <select
              value={country.code}
              disabled={disabled}
              onChange={(e) => {
                const next =
                  PHONE_COUNTRIES.find((c) => c.code === e.target.value) ?? DEFAULT_COUNTRY;
                onChange(buildPhoneValue(next, local));
              }}
              className="w-full h-full min-h-[48px] pl-3 pr-2 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 appearance-none cursor-pointer disabled:opacity-50"
              aria-label="مفتاح الدولة"
            >
              {PHONE_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.dial} {c.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-outline text-sm pointer-events-none">
              public
            </span>
          </div>
        ) : (
          <div className="relative shrink-0 w-[min(44%,130px)] sm:w-[120px]">
            <input
              type="text"
              value={manualDial}
              disabled={disabled}
              onChange={(e) => {
                const nextDial = normalizeDial(e.target.value);
                setManualDial(nextDial);
                onChange(buildPhoneValueFromDial(nextDial, local));
              }}
              placeholder="+966"
              dir="ltr"
              aria-label="مفتاح الدولة يدوياً"
              className="w-full min-h-[48px] px-3 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-container/40 transition-all disabled:opacity-50"
            />
          </div>
        )}

        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
            phone
          </span>
          <input
            type="tel"
            value={local}
            disabled={disabled}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              if (inputMode === "manual") {
                onChange(buildPhoneValueFromDial(manualDial, digits));
              } else {
                onChange(buildPhoneValue(country, digits));
              }
            }}
            placeholder={placeholder}
            dir="ltr"
            className="w-full pr-11 pl-4 py-3 bg-surface-container-high border border-outline-variant/10 rounded-xl text-on-surface text-sm outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary-container/40 transition-all disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}

export function formatPhoneDisplay(value: string) {
  if (!value) return "";
  const { country, dial, local, isManualDial } = parsePhoneValue(value);
  if (!local) return value;
  if (isManualDial) return `${dial} ${local}`;
  return `${country.flag} ${dial} ${local}`;
}
