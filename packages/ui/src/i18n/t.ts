import ko from "./locales/ko-KR.json";
import en from "./locales/en-US.json";

export type Locale = "ko-KR" | "en-US";

const LOCALE_KEY = "ui.appearance.locale";

const dictionaries = {
  "ko-KR": ko,
  "en-US": en,
} as const;

export type I18nKey = keyof typeof dictionaries["ko-KR"];

let currentLocale: Locale = "ko-KR";

if (typeof window !== "undefined") {
  const saved = window.localStorage.getItem(LOCALE_KEY);
  if (saved === "ko-KR" || saved === "en-US") {
    currentLocale = saved;
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale) {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_KEY, locale);
  }
}

export const t = (key: I18nKey, locale?: Locale): string => {
  const effectiveLocale = locale ?? currentLocale;
  const dict = dictionaries[effectiveLocale] ?? dictionaries["ko-KR"];
  return dict[key] ?? key;
};
