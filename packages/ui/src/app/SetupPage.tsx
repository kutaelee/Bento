import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createApiClient } from "../api/client";
import { ApiError } from "../api/errors";
import { createSetupApi } from "../api/setup";
import { Button, PasswordField, TextField } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { saveAuthTokens } from "./authTokens";
import { getSetupGateDecision } from "./setupGate";
import "./SetupPage.css";

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
    if (!formState.username || !formState.password) {
      setFormErrorKey("err.validation");
      return;
    }

    setSubmitting(true);
    setFormErrorKey(null);

    try {
      const response = await setupApi.createAdmin({
        username: formState.username,
        password: formState.password,
        display_name: formState.displayName || undefined,
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

  if (loading) {
    return (
      <main className="setup-page">
        <section className="setup-page__card">
          <h1 className="setup-page__title">{t("setup.title")}</h1>
          <p className="setup-page__subtitle">{t("setup.loading")}</p>
          {statusErrorKey ? <p className="setup-page__error">{t(statusErrorKey)}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="setup-page">
      <form className="setup-page__card" onSubmit={submit}>
        <h1 className="setup-page__title">{t("setup.title")}</h1>
        <p className="setup-page__subtitle">{t("setup.subtitle")}</p>
        {statusErrorKey ? <p className="setup-page__error">{t(statusErrorKey)}</p> : null}

        <TextField
          name="username"
          autoComplete="username"
          label={t("field.username")}
          value={formState.username}
          onChange={updateField("username")}
          disabled={submitting}
        />

        <PasswordField
          name="password"
          autoComplete="new-password"
          label={t("field.password")}
          value={formState.password}
          onChange={updateField("password")}
          disabled={submitting}
        />

        <TextField
          name="displayName"
          autoComplete="name"
          label={t("setup.displayName")}
          value={formState.displayName}
          onChange={updateField("displayName")}
          disabled={submitting}
        />

        {formErrorKey ? <p className="setup-page__error">{t(formErrorKey)}</p> : null}

        <div className="setup-page__actions">
          <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
            {t("action.createAdmin")}
          </Button>
        </div>
      </form>
    </main>
  );
}
