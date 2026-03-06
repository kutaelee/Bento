import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createSetupApi } from "../api/setup";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { saveAuthTokens } from "./authTokens";
import { getSetupGateDecision } from "./setupGate";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.css";

type SetupFormState = {
  username: string;
  password: string;
  displayName: string;
};

const defaultFormState: SetupFormState = {
  username: "",
  password: "",
  displayName: "",
};

export function SetupPage() {
  const navigate = useNavigate();
  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        getLocale: () => "ko-KR",
      }),
    [],
  );
  const setupApi = useMemo(() => createSetupApi(apiClient), [apiClient]);
  const [loading, setLoading] = useState(true);
  const [statusErrorKey, setStatusErrorKey] = useState<I18nKey | null>(null);
  const [formState, setFormState] = useState<SetupFormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);
  const [formErrorKey, setFormErrorKey] = useState<I18nKey | null>(null);

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      setLoading(true);
      setStatusErrorKey(null);
      try {
        const status = await setupApi.status();
        if (!active) return;
        const decision = getSetupGateDecision(status.setup_required);
        if (!decision.allow && decision.redirectTo) {
          navigate(decision.redirectTo, { replace: true });
          return;
        }
        setLoading(false);
      } catch (error) {
        if (!active) return;
        setStatusErrorKey(error instanceof ApiError ? error.key : "err.network");
        setLoading(false);
      }
    };

    void loadStatus();

    return () => {
      active = false;
    };
  }, [navigate, setupApi]);

  const updateField = (key: keyof SetupFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.username.trim() || !formState.password) {
      setFormErrorKey("err.validation");
      return;
    }

    setSubmitting(true);
    setFormErrorKey(null);

    try {
      const response = await setupApi.createAdmin({
        username: formState.username.trim(),
        password: formState.password,
        display_name: formState.displayName.trim() || undefined,
        locale: "ko-KR",
      });
      saveAuthTokens(response.tokens);
      navigate("/files", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormErrorKey(error.key);
      } else {
        setFormErrorKey("err.network");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const statusBlock = loading ? (
    <p className="auth-form__hint">{t("setup.loading")}</p>
  ) : statusErrorKey ? (
    <p className="auth-form__error">{t(statusErrorKey)}</p>
  ) : (
    <ul className="auth-form__status-list">
      <li>{t("setup.stepAccount")}</li>
      <li>{t("setup.stepSecurity")}</li>
      <li>{t("setup.stepComplete")}</li>
    </ul>
  );

  return (
    <AuthLayout
      titleKey="setup.title"
      subtitleKey="setup.subtitle"
      status={statusBlock}
      sidebarTitleKey="setup.heroTitle"
      sidebarBodyKey="setup.heroBody"
      sidebarItems={[
        { labelKey: "field.status", value: loading ? t("msg.loading") : t("status.validation") },
        { labelKey: "field.active", value: t("setup.metricInviteOnly") },
      ]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form__fields">
          <div className="auth-form__split">
            <TextField
              name="username"
              autoComplete="username"
              label={t("field.username")}
              value={formState.username}
              onChange={updateField("username")}
              disabled={submitting || loading}
              error={formErrorKey === "err.validation" && !formState.username.trim() ? t(formErrorKey) : undefined}
            />

            <TextField
              name="displayName"
              autoComplete="name"
              label={t("setup.displayName")}
              value={formState.displayName}
              onChange={updateField("displayName")}
              disabled={submitting || loading}
            />
          </div>

          <PasswordField
            name="password"
            autoComplete="new-password"
            label={t("field.password")}
            value={formState.password}
            onChange={updateField("password")}
            disabled={submitting || loading}
            error={formErrorKey === "err.validation" && !formState.password ? t(formErrorKey) : undefined}
          />
        </div>

        {formErrorKey && formErrorKey !== "err.validation" ? <p className="auth-form__error">{t(formErrorKey)}</p> : null}

        <div className="auth-form__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={loading || submitting || !formState.username.trim() || !formState.password}>
            {t("action.createAdmin")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
