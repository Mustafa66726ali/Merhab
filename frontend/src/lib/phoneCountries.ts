/** رموز الاتصال الدولية لحقل واتساب — الدول العربية + دول شائعة (50+). */

export interface PhoneCountry {
  code: string;
  nameAr: string;
  nameEn: string;
  region: "arab" | "intl";
  placeholder: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "966", nameAr: "السعودية", nameEn: "Saudi Arabia", region: "arab", placeholder: "512345678" },
  { code: "971", nameAr: "الإمارات", nameEn: "UAE", region: "arab", placeholder: "501234567" },
  { code: "973", nameAr: "البحرين", nameEn: "Bahrain", region: "arab", placeholder: "36123456" },
  { code: "965", nameAr: "الكويت", nameEn: "Kuwait", region: "arab", placeholder: "50123456" },
  { code: "968", nameAr: "عُمان", nameEn: "Oman", region: "arab", placeholder: "91234567" },
  { code: "974", nameAr: "قطر", nameEn: "Qatar", region: "arab", placeholder: "33123456" },
  { code: "967", nameAr: "اليمن", nameEn: "Yemen", region: "arab", placeholder: "712345678" },
  { code: "20", nameAr: "مصر", nameEn: "Egypt", region: "arab", placeholder: "1012345678" },
  { code: "962", nameAr: "الأردن", nameEn: "Jordan", region: "arab", placeholder: "791234567" },
  { code: "961", nameAr: "لبنان", nameEn: "Lebanon", region: "arab", placeholder: "71234567" },
  { code: "963", nameAr: "سوريا", nameEn: "Syria", region: "arab", placeholder: "944567890" },
  { code: "964", nameAr: "العراق", nameEn: "Iraq", region: "arab", placeholder: "7901234567" },
  { code: "970", nameAr: "فلسطين", nameEn: "Palestine", region: "arab", placeholder: "591234567" },
  { code: "218", nameAr: "ليبيا", nameEn: "Libya", region: "arab", placeholder: "912345678" },
  { code: "216", nameAr: "تونس", nameEn: "Tunisia", region: "arab", placeholder: "20123456" },
  { code: "213", nameAr: "الجزائر", nameEn: "Algeria", region: "arab", placeholder: "551234567" },
  { code: "212", nameAr: "المغرب", nameEn: "Morocco", region: "arab", placeholder: "612345678" },
  { code: "249", nameAr: "السودان", nameEn: "Sudan", region: "arab", placeholder: "912345678" },
  { code: "222", nameAr: "موريتانيا", nameEn: "Mauritania", region: "arab", placeholder: "41234567" },
  { code: "252", nameAr: "الصومال", nameEn: "Somalia", region: "arab", placeholder: "612345678" },
  { code: "253", nameAr: "جيبوتي", nameEn: "Djibouti", region: "arab", placeholder: "77831234" },
  { code: "269", nameAr: "جزر القمر", nameEn: "Comoros", region: "arab", placeholder: "3212345" },
  { code: "1", nameAr: "الولايات المتحدة / كندا", nameEn: "US / Canada", region: "intl", placeholder: "2025550123" },
  { code: "44", nameAr: "المملكة المتحدة", nameEn: "UK", region: "intl", placeholder: "7911123456" },
  { code: "33", nameAr: "فرنسا", nameEn: "France", region: "intl", placeholder: "612345678" },
  { code: "49", nameAr: "ألمانيا", nameEn: "Germany", region: "intl", placeholder: "15123456789" },
  { code: "39", nameAr: "إيطاليا", nameEn: "Italy", region: "intl", placeholder: "3123456789" },
  { code: "34", nameAr: "إسبانيا", nameEn: "Spain", region: "intl", placeholder: "612345678" },
  { code: "31", nameAr: "هولندا", nameEn: "Netherlands", region: "intl", placeholder: "612345678" },
  { code: "32", nameAr: "بلجيكا", nameEn: "Belgium", region: "intl", placeholder: "470123456" },
  { code: "41", nameAr: "سويسرا", nameEn: "Switzerland", region: "intl", placeholder: "781234567" },
  { code: "46", nameAr: "السويد", nameEn: "Sweden", region: "intl", placeholder: "701234567" },
  { code: "47", nameAr: "النرويج", nameEn: "Norway", region: "intl", placeholder: "41234567" },
  { code: "45", nameAr: "الدنمارك", nameEn: "Denmark", region: "intl", placeholder: "20123456" },
  { code: "90", nameAr: "تركيا", nameEn: "Turkey", region: "intl", placeholder: "5321234567" },
  { code: "91", nameAr: "الهند", nameEn: "India", region: "intl", placeholder: "9876543210" },
  { code: "92", nameAr: "باكستان", nameEn: "Pakistan", region: "intl", placeholder: "3012345678" },
  { code: "93", nameAr: "أفغانستان", nameEn: "Afghanistan", region: "intl", placeholder: "701234567" },
  { code: "98", nameAr: "إيران", nameEn: "Iran", region: "intl", placeholder: "9123456789" },
  { code: "60", nameAr: "ماليزيا", nameEn: "Malaysia", region: "intl", placeholder: "123456789" },
  { code: "62", nameAr: "إندونيسيا", nameEn: "Indonesia", region: "intl", placeholder: "8123456789" },
  { code: "63", nameAr: "الفلبين", nameEn: "Philippines", region: "intl", placeholder: "9123456789" },
  { code: "66", nameAr: "تايلاند", nameEn: "Thailand", region: "intl", placeholder: "812345678" },
  { code: "81", nameAr: "اليابان", nameEn: "Japan", region: "intl", placeholder: "9012345678" },
  { code: "82", nameAr: "كوريا الجنوبية", nameEn: "South Korea", region: "intl", placeholder: "1012345678" },
  { code: "86", nameAr: "الصين", nameEn: "China", region: "intl", placeholder: "13123456789" },
  { code: "61", nameAr: "أستراليا", nameEn: "Australia", region: "intl", placeholder: "412345678" },
  { code: "64", nameAr: "نيوزيلندا", nameEn: "New Zealand", region: "intl", placeholder: "211234567" },
  { code: "27", nameAr: "جنوب أفريقيا", nameEn: "South Africa", region: "intl", placeholder: "712345678" },
  { code: "234", nameAr: "نيجيريا", nameEn: "Nigeria", region: "intl", placeholder: "8012345678" },
  { code: "254", nameAr: "كينيا", nameEn: "Kenya", region: "intl", placeholder: "712345678" },
  { code: "55", nameAr: "البرازيل", nameEn: "Brazil", region: "intl", placeholder: "11987654321" },
  { code: "52", nameAr: "المكسيك", nameEn: "Mexico", region: "intl", placeholder: "5512345678" },
  { code: "7", nameAr: "روسيا", nameEn: "Russia", region: "intl", placeholder: "9123456789" },
  { code: "380", nameAr: "أوكرانيا", nameEn: "Ukraine", region: "intl", placeholder: "501234567" },
  { code: "351", nameAr: "البرتغال", nameEn: "Portugal", region: "intl", placeholder: "912345678" },
  { code: "30", nameAr: "اليونان", nameEn: "Greece", region: "intl", placeholder: "6912345678" },
];

/** ترتيب حسب طول الرمز لمطابقة أطول بادئة أولاً (مثلاً 966 قبل 96). */
export const PHONE_COUNTRIES_BY_CODE_LEN = [...PHONE_COUNTRIES].sort(
  (a, b) => b.code.length - a.code.length
);

export const DEFAULT_PHONE_COUNTRY_CODE = "966";

export function getCountryByCode(code: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find((c) => c.code === code);
}

export function parsePhoneE164(e164: string): { dialCode: string; national: string } {
  const digits = (e164 || "").replace(/\D/g, "");
  if (!digits) {
    return { dialCode: DEFAULT_PHONE_COUNTRY_CODE, national: "" };
  }
  for (const country of PHONE_COUNTRIES_BY_CODE_LEN) {
    if (digits.startsWith(country.code)) {
      return { dialCode: country.code, national: digits.slice(country.code.length) };
    }
  }
  return { dialCode: DEFAULT_PHONE_COUNTRY_CODE, national: digits };
}

export function buildPhoneE164(dialCode: string, national: string): string {
  const nationalDigits = national.replace(/\D/g, "");
  if (!nationalDigits) return "";
  return `+${dialCode}${nationalDigits}`;
}

export function buildWaMeLink(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "";
}

export function filterCountries(region: "arab" | "all"): PhoneCountry[] {
  if (region === "arab") {
    return PHONE_COUNTRIES.filter((c) => c.region === "arab");
  }
  return PHONE_COUNTRIES;
}
