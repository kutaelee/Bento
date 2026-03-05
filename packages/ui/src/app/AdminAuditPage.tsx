import React, { useCallback, useMemo, useState } from "react";
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
      <PageHeader
        title={t("admin.audit.title")}
        actions={
          <Toolbar>
            <TextField
              value={query}
              onChange={onQueryChange}
              placeholder={t("admin.audit.searchPlaceholder")}
            />
            <Button variant="ghost" onClick={refresh} disabled={loading}>
              {t("admin.audit.reload")}
            </Button>
          </Toolbar>
        }
      />

      {loading ? <LoadingSkeleton lines={6} /> : null}

      {errorKey ? <ErrorState title={t(errorKey)} /> : null}

      {!loading && !errorKey && filteredEvents.length === 0 ? (
        <EmptyState title={t("admin.audit.empty")} />
      ) : null}

      {!loading && !errorKey && filteredEvents.length > 0 ? (
        <div className="admin-audit__panel">
          <DataTable
            items={filteredEvents}
            getRowKey={(item) => item.id}
            heightPx={260}
            rowHeightPx={44}
            columns={[
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
            ]}
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
