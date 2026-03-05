import React, { useCallback, useMemo, useState } from "react";
import { Button, ErrorState, LoadingSkeleton, PageHeader, Toolbar } from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { t } from "../i18n/t";
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
  const [current, setCurrent] = useState<AppearanceConfig>({
    locale: "ko-KR",
    theme: "system",
  });
  const [draft, setDraft] = useState<AppearanceConfig>({
    locale: "ko-KR",
    theme: "system",
  });

  const hasChanges = useMemo(
    () => draft.locale !== current.locale || draft.theme !== current.theme,
    [draft.locale, draft.theme, current.locale, current.theme],
  );

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);
    setMessageKey(null);

    try {
      const me = await api.getPreferences();

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
      setCurrent(draft);
      setMessageKey("admin.appearance.saved");
    } catch {
      setErrorKey("admin.appearance.saveError");
    } finally {
      setSaving(false);
    }
  }, [api, draft]);

  const onReset = useCallback(() => {
    setDraft(current);
    setMessageKey("admin.appearance.reset");
  }, [current]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) {
    return <LoadingSkeleton lines={8} />;
  }

  if (errorKey) {
    return <ErrorState title={t("admin.appearance.error")} detail={t(errorKey)} />;
  }

  return (
    <section className="admin-appearance">
      <PageHeader
        title={t("admin.appearance.title")}
        actions={
          <Toolbar>
            <Button disabled={!hasChanges || saving} onClick={onReset}>
              {t("admin.appearance.reset")}
            </Button>
            <Button disabled={!hasChanges || saving} onClick={onSave}>
              {saving ? t("admin.appearance.saving") : t("action.save")}
            </Button>
          </Toolbar>
        }
      />

      {messageKey ? <p className="admin-appearance__message">{t(messageKey)}</p> : null}

      <section className="admin-appearance__section">
        <h2>{t("admin.appearance.languageTitle")}</h2>
        <p>{t("admin.appearance.languageDescription")}</p>
        <div className="admin-appearance__segmented" role="radiogroup" aria-label={t("admin.appearance.languageTitle")}>
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

      <section className="admin-appearance__section">
        <h2>{t("admin.appearance.themeTitle")}</h2>
        <p>{t("admin.appearance.themeDescription")}</p>
        <div className="admin-appearance__segmented" role="radiogroup" aria-label={t("admin.appearance.themeTitle")}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = option.value === draft.theme;
            return (
              <Button
                key={option.value}
                variant={isSelected ? "primary" : "ghost"}
                onClick={() => { setDraft((prev) => ({ ...prev, theme: option.value })); toggleTheme(option.value); }}
                aria-checked={isSelected}
                role="radio"
              >
                {t(option.labelKey)}
              </Button>
            );
          })}
        </div>
      </section>

      <p className="admin-appearance__hint">{t("admin.appearance.themeHint")}</p>
      {hasChanges ? null : <p className="admin-appearance__hint">{t("admin.appearance.noChanges")}</p>}
    </section>
  );
}
