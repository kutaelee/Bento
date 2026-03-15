import ko from "./locales/ko-KR.json";
import en from "./locales/en-US.json";

export type Locale = "ko-KR" | "en-US";

const LOCALE_KEY = "ui.appearance.locale";
export const LOCALE_CHANGE_EVENT = "bento:locale-change";

type Dictionary = Record<string, string>;

const dictionaries: Record<Locale, Dictionary> = {
  "ko-KR": ko as Dictionary,
  "en-US": en as Dictionary,
};

export type I18nKey = string;

const suspiciousLatin1Run = /[\u00C0-\u00FF]{2,}/;
const suspiciousSpacedAscii = /\b(?:[A-Za-z]{1,2}\s+){2,}[A-Za-z]{1,2}\b/;
const suspiciousHanForKorean = /[\u4E00-\u9FFF]/;

const isSuspiciousTranslation = (value: string, locale: Locale) => {
  if (!value.trim()) return true;
  if (value.includes("\uFFFD")) return true;
  if (value.includes("??")) return true;
  if (suspiciousLatin1Run.test(value)) return true;
  if (locale === "ko-KR" && suspiciousHanForKorean.test(value)) return true;
  if (locale === "en-US" && suspiciousSpacedAscii.test(value)) return true;
  return false;
};

const humanizeKey = (key: string | number): string =>
  String(key)
    .split(".")
    .at(-1)
    ?.replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ?? String(key);

export function getLocale(): Locale {
  if (typeof window === "undefined") return "ko-KR";
  const locale = window.localStorage.getItem(LOCALE_KEY);
  return locale === "en-US" ? "en-US" : "ko-KR";
}

export function setLocale(locale: Locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCALE_KEY, locale);
  window.dispatchEvent(new CustomEvent(LOCALE_CHANGE_EVENT, { detail: locale }));
}

export function t(key: I18nKey | string, locale: Locale = getLocale()): string {
  const normalizedKey = String(key);
  const primaryValue = dictionaries[locale][normalizedKey];
  if (typeof primaryValue === "string" && !isSuspiciousTranslation(primaryValue, locale)) {
    return primaryValue;
  }

  const fallbackLocale: Locale = locale === "ko-KR" ? "en-US" : "ko-KR";
  const fallbackValue = dictionaries[fallbackLocale][normalizedKey];
  if (typeof fallbackValue === "string" && !isSuspiciousTranslation(fallbackValue, fallbackLocale)) {
    return fallbackValue;
  }

  return humanizeKey(normalizedKey);
}
