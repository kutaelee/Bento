import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAuthApi } from "../api/auth";
import { getLocale, t, type I18nKey } from "../i18n/t";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { saveAuthTokens } from "./authTokens";
import { getAppBasePath, withBasePath } from "./basePath";
import { AuthLayout } from "./AuthLayout";
import "./AuthForm.css";

export type InviteAcceptFormState = {
  token: string;
  username: string;
  password: string;
  displayName: string;
};

export type InviteAcceptViewProps = {
  tokenMissing: boolean;
  submitting: boolean;
  errorKey: I18nKey | null;
  formState: InviteAcceptFormState;
  onFieldChange: (key: keyof InviteAcceptFormState) => (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

const defaultFormState: InviteAcceptFormState = {
  token: "",
  username: "",
  password: "",
  displayName: "",
};

const usernamePattern = /^[a-zA-Z0-9_.-]{3,32}$/;

const mapInviteAcceptError = (error: ApiError): I18nKey => {
  if (error.status !== 400 || error.key !== "err.validation") {
    return error.key;
  }

  switch (String(error.message || "").trim()) {
    case "token must be a string":
      return "msg.inviteMissingToken";
    case "username must be a string":
    case "username length must be 3..32":
      return "msg.inviteUsernameRule";
    case "username has invalid format":
      return "msg.inviteUsernameFormat";
    case "password must be a string":
    case "password length must be 8..128":
      return "msg.invitePasswordRule";
    case "display_name must be a string":
    case "display_name maxLength is 64":
      return "msg.inviteDisplayNameRule";
    default:
      return error.key;
  }
};

export function InviteAcceptView({
  tokenMissing,
  submitting,
  errorKey,
  formState,
  onFieldChange,
  onSubmit,
}: InviteAcceptViewProps) {
  const activeErrorKey: I18nKey | null = tokenMissing ? "msg.inviteMissingToken" : errorKey;
  const statusBlock = (
    <ul className="auth-form__status-list">
      <li>{t("msg.inviteStatusWorkspace")}</li>
      <li>{t("msg.inviteStatusPermissions")}</li>
      <li>{tokenMissing ? t("msg.inviteMissingToken") : t("msg.inviteStatusReady")}</li>
    </ul>
  );

  return (
    <AuthLayout
      titleKey="msg.inviteAcceptTitle"
      subtitleKey="msg.inviteAcceptSubtitle"
      status={statusBlock}
      sidebarTitleKey="msg.inviteHeroTitle"
      sidebarBodyKey="msg.inviteHeroBody"
      sidebarItems={[
        { labelKey: "field.permissions", value: t("msg.inviteMetricPermission") },
        { labelKey: "field.status", value: tokenMissing ? t("msg.inviteMissingToken") : t("status.active") },
      ]}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="auth-form__fields">
          <TextField
            name="token"
            autoComplete="off"
            label={t("field.inviteCode")}
            value={formState.token}
            onChange={onFieldChange("token")}
            disabled={submitting}
            aria-label={t("field.inviteCode")}
            error={activeErrorKey === "msg.inviteMissingToken" && !formState.token.trim() ? t(activeErrorKey) : undefined}
          />
          <div className="auth-form__split">
            <div>
              <TextField
                name="username"
                autoComplete="username"
                label={t("field.username")}
                value={formState.username}
                onChange={onFieldChange("username")}
                disabled={submitting}
                aria-label={t("field.username")}
                error={
                  errorKey === "err.validation" && !formState.username.trim()
                    ? t(errorKey)
                    : errorKey === "msg.inviteUsernameRule" || errorKey === "msg.inviteUsernameFormat"
                      ? t(errorKey)
                      : undefined
                }
              />
              <p className="auth-form__hint">{t("msg.inviteUsernameHint")}</p>
            </div>

            <div>
              <TextField
                name="displayName"
                autoComplete="name"
                label={t("field.displayName")}
                value={formState.displayName}
                onChange={onFieldChange("displayName")}
                disabled={submitting}
                aria-label={t("field.displayName")}
                error={errorKey === "msg.inviteDisplayNameRule" ? t(errorKey) : undefined}
              />
              <p className="auth-form__hint">{t("msg.inviteDisplayNameHint")}</p>
            </div>
          </div>

          <div>
            <PasswordField
              name="password"
              autoComplete="new-password"
              label={t("field.password")}
              value={formState.password}
              onChange={onFieldChange("password")}
              disabled={submitting}
              aria-label={t("field.password")}
              error={
                errorKey === "err.validation" && !formState.password
                  ? t(errorKey)
                  : errorKey === "msg.invitePasswordRule"
                    ? t(errorKey)
                    : undefined
              }
            />
            <p className="auth-form__hint">{t("msg.invitePasswordHint")}</p>
          </div>
        </div>

        {activeErrorKey && activeErrorKey !== "err.validation" ? <p className="auth-form__error">{t(activeErrorKey)}</p> : null}

        <div className="auth-form__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={tokenMissing || submitting || !formState.username.trim() || !formState.password}>
            {t("action.acceptInvite")}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}

export function InviteAcceptPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl: getAppBasePath(),
        getLocale,
      }),
    [],
  );
  const authApi = useMemo(() => createAuthApi(apiClient), [apiClient]);
  const token = useMemo(() => {
    return new URLSearchParams(location.search).get("token")?.trim() ?? "";
  }, [location.search]);
  const [formState, setFormState] = useState<InviteAcceptFormState>({ ...defaultFormState, token });
  const tokenMissing = !formState.token.trim();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);

  const redirectAfterAuth = (destination: string) => {
    if (typeof window !== "undefined") {
      window.location.replace(withBasePath(destination));
      return;
    }
    navigate(destination, { replace: true });
  };

  React.useEffect(() => {
    setFormState((prev) => (prev.token === token ? prev : { ...prev, token }));
  }, [token]);

  const onFieldChange = (key: keyof InviteAcceptFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (tokenMissing) {
      setErrorKey("msg.inviteMissingToken");
      return;
    }

    const trimmedUsername = formState.username.trim();
    const trimmedDisplayName = formState.displayName.trim();

    if (!trimmedUsername || !formState.password) {
      setErrorKey("err.validation");
      return;
    }

    if (!usernamePattern.test(trimmedUsername)) {
      setErrorKey(trimmedUsername.length < 3 || trimmedUsername.length > 32 ? "msg.inviteUsernameRule" : "msg.inviteUsernameFormat");
      return;
    }

    if (formState.password.length < 8 || formState.password.length > 128) {
      setErrorKey("msg.invitePasswordRule");
      return;
    }

    if (trimmedDisplayName.length > 64) {
      setErrorKey("msg.inviteDisplayNameRule");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);

    try {
      const response = await authApi.acceptInvite({
        token: formState.token.trim(),
        username: trimmedUsername,
        password: formState.password,
        display_name: trimmedDisplayName || undefined,
      });
      saveAuthTokens(response.tokens);
      const next = new URLSearchParams(location.search).get("next");
      redirectAfterAuth(next && next.startsWith("/") ? next : "/");
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(mapInviteAcceptError(error));
      } else {
        setErrorKey("err.network");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InviteAcceptView
      tokenMissing={tokenMissing}
      submitting={submitting}
      errorKey={errorKey}
      formState={formState}
      onFieldChange={onFieldChange}
      onSubmit={submit}
    />
  );
}
