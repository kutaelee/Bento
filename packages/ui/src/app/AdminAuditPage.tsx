import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  TextField,
} from "@nimbus/ui-kit";
import { t } from "../i18n/t";
import type { I18nKey } from "../i18n/t";
import "./AdminAuditPage.css";

type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  time: string;
  detail: string;
};

const EVENT_SEEDS = [
  {
    id: "evt-001",
    actorKey: "admin.audit.event.actorAdminA" as const,
    actionKey: "admin.audit.event.actionLogin" as const,
    target: "admin:users",
    timeKey: "admin.audit.event.time2m" as const,
    detailKey: "admin.audit.event.detailLoginSuccess" as const,
  },
  {
    id: "evt-002",
    actorKey: "admin.audit.event.actorAdminB" as const,
    actionKey: "admin.audit.event.actionInviteCreated" as const,
    target: "user:guest-123",
    timeKey: "admin.audit.event.time18m" as const,
    detailKey: "admin.audit.event.detailInviteIssued" as const,
  },
  {
    id: "evt-003",
    actorKey: "admin.audit.event.actorSystem" as const,
    actionKey: "admin.audit.event.actionBackupDone" as const,
    target: "jobs:scan-cleanup",
    timeKey: "admin.audit.event.time40m" as const,
    detailKey: "admin.audit.event.detailBackgroundJobSuccess" as const,
  },
] as const;

export default function AdminAuditPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>(
    EVENT_SEEDS.map((event) => ({
      id: event.id,
      actor: t(event.actorKey),
      action: t(event.actionKey),
      target: event.target,
      time: t(event.timeKey),
      detail: t(event.detailKey),
    })),
  );

  const filteredEvents = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return events;

    return events.filter(
      (row) =>
        row.actor.toLowerCase().includes(normalized) ||
        row.action.toLowerCase().includes(normalized) ||
        row.target.toLowerCase().includes(normalized) ||
        row.detail.toLowerCase().includes(normalized),
    );
  }, [events, query]);
  const summaryItems = useMemo(
    () => [
      {
        label: t("admin.audit.summary.visible"),
        value: String(filteredEvents.length),
      },
      {
        label: t("admin.audit.summary.actors"),
        value: String(new Set(filteredEvents.map((event) => event.actor)).size),
      },
      {
        label: t("admin.audit.summary.latest"),
        value: filteredEvents[0]?.time ?? "-",
      },
    ],
    [filteredEvents],
  );
  const columns = useMemo(
    () => [
      {
        id: "actor",
        header: t("admin.audit.column.actor"),
        renderCell: (item: AuditEvent) => item.actor,
      },
      {
        id: "action",
        header: t("admin.audit.column.action"),
        renderCell: (item: AuditEvent) => item.action,
      },
      {
        id: "target",
        header: t("admin.audit.column.target"),
        renderCell: (item: AuditEvent) => item.target,
      },
      {
        id: "time",
        header: t("admin.audit.column.time"),
        renderCell: (item: AuditEvent) => item.time,
      },
    ],
    [],
  );

  const onQueryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.currentTarget.value);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorKey(null);

    try {
      await Promise.resolve();
      setEvents((current) => [...current]);
    } catch {
      setErrorKey("admin.audit.failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section className="admin-audit">
      <header className="admin-audit__hero">
        <div className="admin-audit__hero-copy">
          <p className="admin-audit__eyebrow">{t("admin.home.quickLinksTitle")}</p>
          <h1 className="admin-audit__title">{t("admin.audit.title")}</h1>
          <p className="admin-audit__subtitle">{t("admin.audit.subtitle")}</p>
        </div>
        <div className="admin-audit__hero-actions">
          <TextField
            value={query}
            onChange={onQueryChange}
            placeholder={t("admin.audit.searchPlaceholder")}
          />
          <Button variant="ghost" onClick={refresh} disabled={loading}>
            {t("admin.audit.reload")}
          </Button>
        </div>
      </header>

      <section className="admin-audit__summary">
        {summaryItems.map((item) => (
          <article key={item.label} className="admin-audit__summary-card">
            <span className="admin-audit__summary-label">{item.label}</span>
            <strong className="admin-audit__summary-value">{item.value}</strong>
          </article>
        ))}
      </section>

      {loading ? <LoadingSkeleton lines={6} /> : null}

      {errorKey ? <ErrorState title={t(errorKey)} /> : null}

      {!loading && !errorKey && filteredEvents.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} />
      ) : null}

      {!loading && !errorKey && filteredEvents.length > 0 ? (
        <div className="admin-audit__panel">
          <div className="admin-audit__panel-header">
            <div>
              <p className="admin-audit__panel-eyebrow">{t("admin.audit.title")}</p>
              <h2 className="admin-audit__panel-title">{t("admin.audit.title")}</h2>
            </div>
          </div>
          <DataTable
            items={filteredEvents}
            getRowKey={(item) => item.id}
            heightPx={320}
            rowHeightPx={44}
            columns={columns}
          />
          {filteredEvents.length > 0 ? (
            <p className="admin-audit__detail">
              {t("admin.audit.countHint")} {filteredEvents.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
