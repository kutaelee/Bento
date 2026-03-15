import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  TextField,
} from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { getLocale, t } from "../i18n/t";
import "./AdminSecurityPage.css";

type PolicyScope = "sharing" | "security";

type PolicyRow = {
  id: string;
  scope: PolicyScope;
  policyKey: I18nKey;
  detailKey: I18nKey;
  state: "enabled" | "disabled";
};

const POLICY_ROWS: PolicyRow[] = [
  {
    id: "share-link-default-expiry",
    scope: "sharing",
    policyKey: "admin.security.policies.shareLinkDefaultExpiry.policy",
    detailKey: "admin.security.policies.shareLinkDefaultExpiry.detail",
    state: "enabled",
  },
  {
    id: "share-link-password",
    scope: "sharing",
    policyKey: "admin.security.policies.shareLinkPassword.policy",
    detailKey: "admin.security.policies.shareLinkPassword.detail",
    state: "enabled",
  },
  {
    id: "api-sso-check",
    scope: "security",
    policyKey: "admin.security.policies.apiSso.policy",
    detailKey: "admin.security.policies.apiSso.detail",
    state: "disabled",
  },
  {
    id: "login-2fa",
    scope: "security",
    policyKey: "admin.security.policies.login2Fa.policy",
    detailKey: "admin.security.policies.login2Fa.detail",
    state: "enabled",
  },
];

function stateLabel(state: PolicyRow["state"]) {
  return state === "enabled" ? t("admin.security.stateEnabled") : t("admin.security.stateDisabled");
}

function makeColumns() {
  return [
    {
      id: "policy",
      header: t("admin.security.policy"),
      renderCell: (item: SecurityPolicyRow) => t(item.policyKey),
    },
    {
      id: "detail",
      header: t("admin.security.policyDescription"),
      renderCell: (item: PolicyRow) => t(item.detailKey),
    },
    {
      id: "state",
      header: t("admin.security.policyState"),
      align: "center" as const,
      renderCell: (item: PolicyRow) => stateLabel(item.state),
    },
  ];
}

type SecurityPolicyRow = PolicyRow & { scopeBadge?: string };

export default function AdminSecurityPage() {
  const locale = getLocale();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [rows, setRows] = useState<SecurityPolicyRow[]>([]);

  const columns = useMemo(() => makeColumns(), [locale]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      await Promise.resolve();
      setRows(
        POLICY_ROWS.map((row) => ({
          ...row,
          scopeBadge:
            row.scope === "sharing"
              ? t("admin.security.section.share.title")
              : t("admin.security.section.security.title"),
        })),
      );
    } catch {
      setErrorKey("err.network");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const queryValue = query.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!queryValue) return rows;

    return rows.filter((row) => {
      const policyLabel = t(row.policyKey).toLowerCase();
      const detailLabel = t(row.detailKey).toLowerCase();
      return policyLabel.includes(queryValue) || detailLabel.includes(queryValue);
    });
  }, [locale, queryValue, rows]);

  const sharedPolicies = useMemo(() => filteredRows.filter((row) => row.scope === "sharing"), [filteredRows]);
  const securePolicies = useMemo(() => filteredRows.filter((row) => row.scope === "security"), [filteredRows]);
  const summaryItems = useMemo(
    () => [
      {
        label: t("admin.security.summary.visible"),
        value: String(filteredRows.length),
      },
      {
        label: t("admin.security.summary.sharing"),
        value: String(sharedPolicies.length),
      },
      {
        label: t("admin.security.summary.enforced"),
        value: String(filteredRows.filter((row) => row.state === "enabled").length),
      },
    ],
    [filteredRows, locale, sharedPolicies.length],
  );

  return (
    <section className="admin-security">
      <header className="admin-security__hero">
        <div className="admin-security__hero-copy">
          <p className="admin-security__eyebrow">{t("admin.home.quickLinksTitle")}</p>
          <h1 className="admin-security__title">{t("admin.security.title")}</h1>
          <p className="admin-security__subtitle">{t("admin.security.subtitle")}</p>
        </div>
        <div className="admin-security__hero-actions">
          <TextField
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("admin.security.searchPlaceholder")}
          />
          <Button variant="secondary" onClick={() => void loadRows()} disabled={loading}>
            {t("action.refresh")}
          </Button>
        </div>
      </header>

      <section className="admin-security__summary">
        {summaryItems.map((item) => (
          <article key={item.label} className="admin-security__summary-card">
            <span className="admin-security__summary-label">{item.label}</span>
            <strong className="admin-security__summary-value">{item.value}</strong>
          </article>
        ))}
      </section>

      {loading ? <LoadingSkeleton lines={6} /> : null}
      {errorKey ? <ErrorState title={t("admin.security.error")} detail={t(errorKey)} /> : null}
      {!loading && !errorKey && filteredRows.length === 0 ? <EmptyState title={t("admin.security.empty")} /> : null}

      {!loading && !errorKey && filteredRows.length > 0 ? (
        <div className="admin-security__layout">
          <section className="admin-security__panel admin-security__panel--list">
            <div className="admin-security__panel-header">
              <div>
                <p className="admin-security__panel-eyebrow">{t("admin.security.title")}</p>
                <h2 className="admin-security__panel-title">{t("admin.security.section.share.title")}</h2>
              </div>
              <span className="admin-security__panel-meta">{sharedPolicies.length}</span>
            </div>
            <p className="admin-security__panel-copy">{t("admin.security.section.share.description")}</p>
            <DataTable
              items={sharedPolicies}
              columns={columns}
              getRowKey={(item) => item.id}
              heightPx={220}
              rowHeightPx={48}
            />
          </section>

          <section className="admin-security__stack">
            <article className="admin-security__panel">
              <div className="admin-security__panel-header">
                <div>
                  <p className="admin-security__panel-eyebrow">{t("admin.security.title")}</p>
                  <h2 className="admin-security__panel-title">{t("admin.security.section.security.title")}</h2>
                </div>
              </div>
              <p className="admin-security__panel-copy">{t("admin.security.section.security.description")}</p>
              <DataTable
                items={securePolicies}
                columns={columns}
                getRowKey={(item) => item.id}
                heightPx={220}
                rowHeightPx={48}
              />
            </article>

            <article className="admin-security__panel admin-security__panel--notice">
              <div className="admin-security__panel-header">
                <div>
                  <p className="admin-security__panel-eyebrow">{t("admin.security.title")}</p>
                  <h2 className="admin-security__panel-title">{t("admin.security.overviewTitle")}</h2>
                </div>
              </div>
              <p className="admin-security__panel-copy">{t("admin.security.overviewDescription")}</p>
              <ul className="admin-security__signal-list">
                <li>{t("admin.security.policies.shareLinkDefaultExpiry.policy")}</li>
                <li>{t("admin.security.policies.shareLinkPassword.policy")}</li>
                <li>{t("admin.security.policies.login2Fa.policy")}</li>
              </ul>
            </article>
          </section>
        </div>
      ) : null}
    </section>
  );
}
