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

const EVENTS: AuditEvent[] = [
  {
    id: "evt-001",
    actor: "관리자 A",
    action: "로그인",
    target: "admin:users",
    time: "2분 전",
    detail: "정상 로그인 성공",
  },
  {
    id: "evt-002",
    actor: "관리자 B",
    action: "초대 생성",
    target: "user:guest-123",
    time: "18분 전",
    detail: "초대 링크 발급",
  },
  {
    id: "evt-003",
    actor: "시스템",
    action: "백업 완료",
    target: "jobs:scan-cleanup",
    time: "40분 전",
    detail: "백그라운드 작업 성공",
  },
];

export default function AdminAuditPage() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>(EVENTS);

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
