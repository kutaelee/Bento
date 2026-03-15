import React, { useCallback, useMemo, useState } from "react";
import { Button, ErrorState, LoadingSkeleton } from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { setLocale, t } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { createMePreferencesApi } from "../api/mePreferences";
import type { components } from "../api/schema";
import "./AdminAppearancePage.css";
import { useTheme } from "../hooks/useTheme";

type ThemeMode = "system" | "light" | "dark";
type LocaleCode = components["schemas"]["Locale"];

type AppearanceConfig = {
  locale: LocaleCode;
  theme: ThemeMode;
};

const LANG_OPTIONS: Array<{ value: LocaleCode; labelKey: I18nKey }> = [
  { value: "ko-KR", labelKey: "admin.appearance.languageKo" },
  { value: "en-US", labelKey: "admin.appearance.languageEn" },
];

const THEME_OPTIONS: Array<{ value: ThemeMode; labelKey: I18nKey }> = [
  { value: "system", labelKey: "admin.appearance.themeSystem" },
  { value: "light", labelKey: "admin.appearance.themeLight" },
  { value: "dark", labelKey: "admin.appearance.themeDark" },
];

function getLocaleLabel(locale: LocaleCode) {
  return t(locale === "ko-KR" ? "admin.appearance.languageKo" : "admin.appearance.languageEn");
}

function getThemeLabel(theme: ThemeMode) {
  return t(
    theme === "system"
      ? "admin.appearance.themeSystem"
      : theme === "light"
        ? "admin.appearance.themeLight"
        : "admin.appearance.themeDark",
  );
}

export default function AdminAppearancePage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const api = useMemo(() => createMePreferencesApi(apiClient), [apiClient]);
  const { theme, toggleTheme } = useTheme();
  const themeRef = React.useRef<ThemeMode>(theme);

  React.useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [messageKey, setMessageKey] = useState<I18nKey | null>(null);
  const [current, setCurrent] = useState<AppearanceConfig>({ locale: "ko-KR", theme: "system" });
  const [draft, setDraft] = useState<AppearanceConfig>({ locale: "ko-KR", theme: "system" });

  const hasChanges = useMemo(
    () => draft.locale !== current.locale || draft.theme !== current.theme,
    [current.locale, current.theme, draft.locale, draft.theme],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    setMessageKey(null);

    try {
      const me = await api.getPreferences();
      setLocale(me.locale);
      const profile: AppearanceConfig = {
        locale: me.locale,
        theme: themeRef.current,
      };
      setCurrent(profile);
      setDraft(profile);
    } catch {
      setErrorKey("admin.appearance.reload");
    } finally {
      setLoading(false);
    }
  }, [api]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setMessageKey(null);
    setErrorKey(null);

    try {
      await api.setPreferences({ locale: draft.locale });
      setLocale(draft.locale);
      toggleTheme(draft.theme);
      setCurrent(draft);
      setMessageKey("admin.appearance.saved");
    } catch {
      setErrorKey("admin.appearance.saveError");
    } finally {
      setSaving(false);
    }
  }, [api, draft, toggleTheme]);

  const onReset = useCallback(() => {
    setDraft(current);
    toggleTheme(current.theme);
    setMessageKey("admin.appearance.reset");
  }, [current, toggleTheme]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const summaryItems = useMemo(
    () => [
      {
        label: t("admin.appearance.summary.language"),
        value: getLocaleLabel(draft.locale),
      },
      {
        label: t("admin.appearance.summary.theme"),
        value: getThemeLabel(draft.theme),
      },
      {
        label: t("admin.appearance.summary.status"),
        value: hasChanges ? t("admin.appearance.summary.pending") : t("admin.appearance.summary.synced"),
      },
    ],
    [draft.locale, draft.theme, hasChanges],
  );

  return (
    <section className="admin-appearance">
      <header className="admin-appearance__hero">
        <div className="admin-appearance__hero-copy">
          <p className="admin-appearance__eyebrow">{t("admin.home.quickLinksTitle")}</p>
          <h1 className="admin-appearance__title">{t("admin.appearance.title")}</h1>
          <p className="admin-appearance__subtitle">{t("admin.appearance.subtitle")}</p>
        </div>
        <div className="admin-appearance__hero-actions">
          <Button variant="secondary" disabled={!hasChanges || saving} onClick={onReset}>
            {t("admin.appearance.reset")}
          </Button>
          <Button disabled={!hasChanges || saving} onClick={onSave}>
            {saving ? t("admin.appearance.saving") : t("action.save")}
          </Button>
        </div>
      </header>

      <section className="admin-appearance__summary">
        {summaryItems.map((item) => (
          <article key={item.label} className="admin-appearance__summary-card">
            <span className="admin-appearance__summary-label">{item.label}</span>
            <strong className="admin-appearance__summary-value">{item.value}</strong>
          </article>
        ))}
      </section>

      {messageKey ? <p className="admin-appearance__message">{t(messageKey)}</p> : null}

      {loading ? <LoadingSkeleton lines={8} /> : null}
      {!loading && errorKey ? <ErrorState title={t("admin.appearance.error")} detail={t(errorKey)} /> : null}

      {!loading && !errorKey ? (
        <div className="admin-appearance__layout">
          <section className="admin-appearance__panel admin-appearance__panel--primary">
            <div className="admin-appearance__panel-header">
              <div>
                <p className="admin-appearance__panel-eyebrow">{t("admin.appearance.title")}</p>
                <h2 className="admin-appearance__panel-title">{t("admin.appearance.languageTitle")}</h2>
              </div>
            </div>
            <p className="admin-appearance__panel-copy">{t("admin.appearance.languageDescription")}</p>
            <div
              className="admin-appearance__segmented"
              role="radiogroup"
              aria-label={t("admin.appearance.languageTitle")}
            >
              {LANG_OPTIONS.map((option) => {
                const isSelected = option.value === draft.locale;
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? "primary" : "ghost"}
                    onClick={() => setDraft((prev) => ({ ...prev, locale: option.value }))}
                    aria-checked={isSelected}
                    role="radio"
                  >
                    {t(option.labelKey)}
                  </Button>
                );
              })}
            </div>
          </section>

          <section className="admin-appearance__stack">
            <article className="admin-appearance__panel">
              <div className="admin-appearance__panel-header">
                <div>
                  <p className="admin-appearance__panel-eyebrow">{t("admin.appearance.title")}</p>
                  <h2 className="admin-appearance__panel-title">{t("admin.appearance.themeTitle")}</h2>
                </div>
              </div>
              <p className="admin-appearance__panel-copy">{t("admin.appearance.themeDescription")}</p>
              <div
                className="admin-appearance__segmented"
                role="radiogroup"
                aria-label={t("admin.appearance.themeTitle")}
              >
                {THEME_OPTIONS.map((option) => {
                  const isSelected = option.value === draft.theme;
                return (
                  <Button
                    key={option.value}
                    variant={isSelected ? "primary" : "ghost"}
                    onClick={() => {
                      setDraft((prev) => ({ ...prev, theme: option.value }));
                      toggleTheme(option.value);
                    }}
                    aria-checked={isSelected}
                    role="radio"
                  >
                      {t(option.labelKey)}
                    </Button>
                  );
                })}
              </div>
            </article>

            <article className="admin-appearance__panel admin-appearance__panel--secondary">
              <div className="admin-appearance__panel-header">
                <div>
                  <p className="admin-appearance__panel-eyebrow">{t("admin.appearance.title")}</p>
                  <h2 className="admin-appearance__panel-title">{t("admin.appearance.overviewTitle")}</h2>
                </div>
              </div>
              <p className="admin-appearance__panel-copy">{t("admin.appearance.overviewDescription")}</p>
              <dl className="admin-appearance__details">
                <div>
                  <dt>{t("admin.appearance.summary.language")}</dt>
                  <dd>{getLocaleLabel(current.locale)}</dd>
                </div>
                <div>
                  <dt>{t("admin.appearance.summary.theme")}</dt>
                  <dd>{getThemeLabel(current.theme)}</dd>
                </div>
                <div>
                  <dt>{t("admin.appearance.summary.status")}</dt>
                  <dd>{hasChanges ? t("admin.appearance.summary.pending") : t("admin.appearance.summary.synced")}</dd>
                </div>
              </dl>
              <p className="admin-appearance__hint">{t("admin.appearance.themeHint")}</p>
              {!hasChanges ? <p className="admin-appearance__hint">{t("admin.appearance.noChanges")}</p> : null}
            </article>
          </section>
        </div>
      ) : null}
    </section>
  );
}
