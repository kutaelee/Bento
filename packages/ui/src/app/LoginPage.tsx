import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { saveAuthTokens } from "./authTokens";
import { ApiError } from "../api/errors";
import { t, type I18nKey } from "../i18n/t";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.css";

type LoginResponse = {
  user: {
    id: string;
    username: string;
    role: string;
    locale: string;
  };
  tokens: {
    token_type: "Bearer";
    access_token: string;
    refresh_token: string;
    expires_in_seconds: number;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const api = useMemo(() => createApiClient({ baseUrl: "" }), []);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setErrorKey("err.validation");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);

    try {
      const response = await api.request<LoginResponse>({
        path: "/auth/login",
        method: "POST",
        body: { username: username.trim(), password },
      });
      saveAuthTokens(response.tokens);
      navigate("/files", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const helperStatus = (
    <ul className="auth-form__status-list">
      <li>{t("msg.loginStatusPrimary")}</li>
      <li>{t("msg.loginStatusSecondary")}</li>
      {capsLockOn ? <li>{t("status.capsLockOn")}</li> : null}
    </ul>
  );

  return (
    <AuthLayout
      titleKey="msg.loginTitle"
      subtitleKey="msg.loginSubtitle"
      status={helperStatus}
      sidebarTitleKey="msg.loginHeroTitle"
      sidebarBodyKey="msg.loginHeroBody"
      sidebarItems={[
        { labelKey: "field.status", value: t("status.readOnly") },
        { labelKey: "field.permissions", value: t("msg.loginMetricSecurity") },
      ]}
    >
      <form className="auth-form" onSubmit={submit}>
        <div className="auth-form__fields">
          <TextField
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            label={t("field.username")}
            aria-label={t("field.username")}
            error={errorKey === "err.validation" && !username.trim() ? t(errorKey) : undefined}
            disabled={submitting}
          />

          <PasswordField
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
            onKeyDown={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
            label={t("field.password")}
            aria-label={t("field.password")}
            error={errorKey === "err.validation" && !password ? t(errorKey) : undefined}
            disabled={submitting}
          />
        </div>

        {errorKey && errorKey !== "err.validation" ? <div className="auth-form__error">{t(errorKey)}</div> : null}
        {capsLockOn ? <p className="auth-form__hint">{t("status.capsLockOn")}</p> : null}

        <div className="auth-form__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting || !username.trim() || !password}>
            {t("action.signIn")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
