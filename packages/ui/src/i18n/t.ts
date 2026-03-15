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

const overrides: Record<Locale, Dictionary> = {
  "ko-KR": {
    "action.upload": "업로드",
    "err.readOnly": "읽기 전용 모드에서는 이 작업을 수행할 수 없습니다.",
    "err.uploadFailed": "업로드를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    "err.invalidCredentials": "아이디 또는 비밀번호가 올바르지 않습니다.",
    "err.notFound": "항목을 찾을 수 없습니다.",
    "action.activateVolume": "볼륨 활성화",
    "action.deactivateVolume": "볼륨 비활성화",
    "admin.appearance.themeDark": "다크",
    "admin.audit.column.action": "동작",
    "admin.users.title": "사용자 및 초대",
    "msg.filesDescription": "요약 카드, 메인 데이터 영역, 보조 패널을 사용해 반복적인 파일 작업을 빠르게 처리하세요.",
    "msg.loginHeroTitle": "운영 중심 NAS 워크스페이스",
    "nav.media": "미디어",
    "msg.volumeActivated": "볼륨이 활성화되었습니다.",
    "msg.volumeCreated": "볼륨이 생성되었습니다.",
    "msg.volumeDeactivated": "볼륨이 비활성화되었습니다.",
    "msg.volumeDeleted": "볼륨이 삭제되었습니다.",
    "msg.inviteNotFound": "초대 코드를 찾을 수 없습니다.",
    "msg.inviteExpired": "초대 링크가 만료되었습니다.",
    "msg.inviteAlreadyUsed": "이미 사용된 초대 코드입니다.",
    "msg.usernameTaken": "이미 사용 중인 아이디입니다.",
  },
  "en-US": {
    "err.readOnly": "This action is unavailable while the system is in read-only mode.",
    "err.uploadFailed": "The upload could not be completed. Please try again.",
    "err.invalidCredentials": "Username or password is incorrect.",
    "action.deactivateVolume": "Deactivate volume",
    "msg.volumeDeactivated": "Volume deactivated.",
    "msg.volumeDeleted": "Volume deleted.",
    "msg.inviteNotFound": "Invite code was not found.",
    "msg.inviteExpired": "Invite link has expired.",
    "msg.inviteAlreadyUsed": "This invite has already been used.",
    "msg.usernameTaken": "That username is already in use.",
  },
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
  const overrideValue = overrides[locale][normalizedKey];
  if (typeof overrideValue === "string" && !isSuspiciousTranslation(overrideValue, locale)) {
    return overrideValue;
  }

  const primaryValue = dictionaries[locale][normalizedKey];
  if (typeof primaryValue === "string" && !isSuspiciousTranslation(primaryValue, locale)) {
    return primaryValue;
  }

  const fallbackLocale: Locale = locale === "ko-KR" ? "en-US" : "ko-KR";
  const fallbackOverride = overrides[fallbackLocale][normalizedKey];
  if (typeof fallbackOverride === "string" && !isSuspiciousTranslation(fallbackOverride, fallbackLocale)) {
    return fallbackOverride;
  }

  const fallbackValue = dictionaries[fallbackLocale][normalizedKey];
  if (typeof fallbackValue === "string" && !isSuspiciousTranslation(fallbackValue, fallbackLocale)) {
    return fallbackValue;
  }

  return humanizeKey(normalizedKey);
}
