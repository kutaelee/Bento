import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { saveAuthTokens } from "./authTokens";
import { ApiError } from "../api/errors";
import { t, type I18nKey } from "../i18n/t";
import "./LoginPage.css";

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username || !password) {
      setErrorKey("err.validation");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);

    try {
      const response = await api.request<LoginResponse>({
        path: "/auth/login",
        method: "POST",
        body: { username, password },
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

  return (
    <main className="login-page">
      <form className="login-page__card" onSubmit={submit}>
        <h1 className="login-page__title">{t("msg.loginTitle")}</h1>

        <TextField
          name="username"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          label={t("field.username")}
          aria-label={t("field.username")}
        />

        <PasswordField
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          label={t("field.password")}
          aria-label={t("field.password")}
        />

        {errorKey ? <div className="login-page__error">{t(errorKey)}</div> : null}

        <div className="login-page__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            {t("action.signIn")}
          </Button>
        </div>
      </form>
    </main>
  );
}
