import ko from "./locales/ko-KR.json";
import en from "./locales/en-US.json";

export type Locale = "ko-KR" | "en-US";

const dictionaries = {
  "ko-KR": ko,
  "en-US": en,
} as const;

export type I18nKey = keyof typeof dictionaries["ko-KR"];

export const t = (key: I18nKey, locale: Locale = "ko-KR"): string => {
  const dict = dictionaries[locale] ?? dictionaries["ko-KR"];
  return dict[key] ?? key;
};
