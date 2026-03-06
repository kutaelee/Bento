import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  TextField,
  Toolbar,
} from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { t } from "../i18n/t";
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
      renderCell: (item: PolicyRow) => t(item.policyKey),
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

export default function AdminSecurityPage() {
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [rows, setRows] = useState<PolicyRow[]>([]);

  const columns = useMemo(() => makeColumns(), []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      await Promise.resolve();
      setRows(POLICY_ROWS);
    } catch {
      setErrorKey("err.network");
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [queryValue, rows]);

  const sharedPolicies = useMemo(() => filteredRows.filter((row) => row.scope === "sharing"), [filteredRows]);
  const securePolicies = useMemo(() => filteredRows.filter((row) => row.scope === "security"), [filteredRows]);

  return (
    <section className="admin-security">
      <PageHeader
        title={t("admin.security.title")}
        actions={
          <Toolbar>
            <TextField
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("admin.security.searchPlaceholder")}
            />
            <Button variant="ghost" onClick={() => void loadRows()}>
              {t("action.refresh")}
            </Button>
          </Toolbar>
        }
      />

      <section className="admin-security__summary">
        <div className="admin-security__summary-card">
          <span>{t("admin.security.section.share.title")}</span>
          <strong>{sharedPolicies.length}</strong>
        </div>
        <div className="admin-security__summary-card">
          <span>{t("admin.security.section.security.title")}</span>
          <strong>{securePolicies.length}</strong>
        </div>
      </section>

      {loading ? <LoadingSkeleton lines={6} /> : null}
      {errorKey ? <ErrorState title={t("admin.security.error")} detail={t(errorKey)} /> : null}
      {!loading && !errorKey && filteredRows.length === 0 ? <EmptyState title={t("admin.security.empty")} /> : null}

      {!loading && !errorKey && filteredRows.length > 0 ? (
        <>
          <section className="admin-security__section">
            <h2>{t("admin.security.section.share.title")}</h2>
            <p>{t("admin.security.section.share.description")}</p>
            <div className="admin-security__panel">
              <DataTable
                items={sharedPolicies}
                columns={columns}
                getRowKey={(item) => item.id}
                heightPx={190}
                rowHeightPx={48}
              />
            </div>
          </section>

          <section className="admin-security__section">
            <h2>{t("admin.security.section.security.title")}</h2>
            <p>{t("admin.security.section.security.description")}</p>
            <div className="admin-security__panel">
              <DataTable
                items={securePolicies}
                columns={columns}
                getRowKey={(item) => item.id}
                heightPx={190}
                rowHeightPx={48}
              />
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
