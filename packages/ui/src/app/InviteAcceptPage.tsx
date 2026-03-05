import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createAuthApi } from "../api/auth";
import { t, type I18nKey } from "../i18n/t";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { saveAuthTokens } from "./authTokens";
import "./InviteAcceptPage.css";

export type InviteAcceptFormState = {
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
  username: "",
  password: "",
  displayName: "",
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

  return (
    <main className="invite-accept">
      <form className="invite-accept__card" onSubmit={onSubmit}>
        <h1 className="invite-accept__title">{t("msg.inviteAcceptTitle")}</h1>
        <p className="invite-accept__subtitle">{t("msg.inviteAcceptSubtitle")}</p>

        {activeErrorKey ? <p className="invite-accept__error">{t(activeErrorKey)}</p> : null}

        <TextField
          name="username"
          autoComplete="username"
          label={t("field.username")}
          value={formState.username}
          onChange={onFieldChange("username")}
          disabled={submitting}
          aria-label={t("field.username")}
        />

        <PasswordField
          name="password"
          autoComplete="new-password"
          label={t("field.password")}
          value={formState.password}
          onChange={onFieldChange("password")}
          disabled={submitting}
          aria-label={t("field.password")}
        />

        <TextField
          name="displayName"
          autoComplete="name"
          label={t("field.displayName")}
          value={formState.displayName}
          onChange={onFieldChange("displayName")}
          disabled={submitting}
          aria-label={t("field.displayName")}
        />

        <div className="invite-accept__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={tokenMissing || submitting}>
            {t("action.acceptInvite")}
          </Button>
        </div>
      </form>
    </main>
  );
}

export function InviteAcceptPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const apiClient = useMemo(
    () =>
      createApiClient({
        baseUrl: "",
        getLocale: () => "ko-KR",
      }),
    [],
  );
  const authApi = useMemo(() => createAuthApi(apiClient), [apiClient]);
  const token = useMemo(() => {
    return new URLSearchParams(location.search).get("token")?.trim() ?? "";
  }, [location.search]);
  const tokenMissing = !token;
  const [formState, setFormState] = useState<InviteAcceptFormState>(defaultFormState);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);

  const onFieldChange = (key: keyof InviteAcceptFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (tokenMissing) {
      setErrorKey("msg.inviteMissingToken");
      return;
    }

    if (!formState.username || !formState.password) {
      setErrorKey("err.validation");
      return;
    }

    setSubmitting(true);
    setErrorKey(null);

    try {
      const response = await authApi.acceptInvite({
        token,
        username: formState.username,
        password: formState.password,
        display_name: formState.displayName || undefined,
      });
      saveAuthTokens(response.tokens);
      navigate("/files", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        if ([401, 403, 404, 409].includes(error.status)) {
          setErrorKey("msg.inviteExpired");
        } else {
          setErrorKey(error.key);
        }
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
