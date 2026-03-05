import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/errors";
import type { NodeItem } from "../api/nodes";
import { createNodesApi } from "../api/nodes";
import { SkeletonBlock, EmptyState, ErrorState, ForbiddenState } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import "./TrashPage.css";

const layoutStyles: Record<string, React.CSSProperties> = {
  error: {
    marginTop: 8,
    color: "var(--nd-color-status-danger)",
  },
  table: {
    display: "grid",
    rowGap: 8,
    marginTop: 12,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr",
    gap: 16,
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 8,
  },
  cell: {
    fontSize: 14,
  },
  headCell: {
    fontWeight: 600,
    color: "var(--nd-color-text-secondary)",
    fontSize: 12,
  },
  nameCell: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  loadMore: {
    marginTop: 12,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--nd-color-border-default)",
    background: "var(--nd-color-surface-primary)",
    cursor: "pointer",
  },
};

const formatSize = (size?: number) => {
  if (size === undefined || size === null) return "-";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export function TrashPage() {
  const { refreshToken, triggerRefresh } = useFolderRefresh();
  const { setSelectedNode } = useInspectorState();

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  const [items, setItems] = useState<NodeItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<I18nKey | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const listVersionRef = useRef(0);

  useEffect(() => {
    let active = true;
    const listVersion = refreshToken + 1;
    listVersionRef.current = listVersion;
    setSelectedNode(null);

    const load = async () => {
      setLoading(true);
      setLoadingMore(false);
      setErrorKey(null);
      setActionErrorKey(null);
      setItems([]);
      setNextCursor(null);
      try {
        const response = await nodesApi.listTrash({});
        if (!active || listVersion !== listVersionRef.current) return;
        setItems(response.items ?? []);
        setNextCursor(response.next_cursor ?? null);
      } catch (error) {
        if (!active || listVersion !== listVersionRef.current) return;
        if (error instanceof ApiError) {
          setErrorKey(error.key);
        } else {
          setErrorKey("err.network");
        }
        setItems([]);
        setNextCursor(null);
      } finally {
        if (active && listVersion === listVersionRef.current) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [nodesApi, refreshToken, setSelectedNode]);

  useEffect(() => {
    return () => {
      setSelectedNode(null);
    };
  }, [setSelectedNode]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const requestVersion = listVersionRef.current;
    setLoadingMore(true);
    setErrorKey(null);
    try {
      const response = await nodesApi.listTrash({ cursor: nextCursor });
      if (requestVersion !== listVersionRef.current) return;
      setItems((prev) => [...prev, ...(response.items ?? [])]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (requestVersion !== listVersionRef.current) return;
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      if (requestVersion === listVersionRef.current) setLoadingMore(false);
    }
  }, [nextCursor, nodesApi]);

  const handleRestore = useCallback(
    async (nodeId: string) => {
      if (actionId) return;
      setActionId(nodeId);
      setActionErrorKey(null);
      try {
        await nodesApi.restoreTrash({ nodeId });
        setItems((prev) => prev.filter((item) => item.id !== nodeId));
        triggerRefresh();
      } catch (error) {
        if (error instanceof ApiError) {
          setActionErrorKey(error.key);
        } else {
          setActionErrorKey("err.network");
        }
      } finally {
        setActionId(null);
      }
    },
    [actionId, nodesApi, triggerRefresh],
  );

  const handleDelete = useCallback(
    async (nodeId: string) => {
      if (actionId) return;
      setActionId(nodeId);
      setActionErrorKey(null);
      try {
        await nodesApi.deleteTrash({ nodeId });
        setItems((prev) => prev.filter((item) => item.id !== nodeId));
        triggerRefresh();
      } catch (error) {
        if (error instanceof ApiError) {
          setActionErrorKey(error.key);
        } else {
          setActionErrorKey("err.network");
        }
      } finally {
        setActionId(null);
      }
    },
    [actionId, nodesApi, triggerRefresh],
  );

  return (
    <section className="trash-page">
      <header className="trash-page__header">
        <div className="trash-page__title">{t("nav.trash")}</div>
      </header>
      {actionErrorKey ? <div style={layoutStyles.error}>{t(actionErrorKey)}</div> : null}
      <div style={layoutStyles.table}>
        <div style={{ ...layoutStyles.row, background: "var(--nd-color-surface-secondary)" }}>
          <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("field.name")}</div>
          <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("field.modifiedAt")}</div>
          <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("field.size")}</div>
          <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("field.owner")}</div>
          <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("action.restore")}</div>
        </div>
        {loading && items.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={`skel-${i}`} style={layoutStyles.row}>
                <SkeletonBlock height={20} width="80%" />
                <SkeletonBlock height={20} width="60%" />
                <SkeletonBlock height={20} width="40%" />
                <SkeletonBlock height={20} width="50%" />
                <SkeletonBlock height={20} width="70%" />
              </div>
            ))}
          </>
        ) : items.map((item) => (
          <div key={item.id} style={layoutStyles.row}>
            <div style={{ ...layoutStyles.cell, ...layoutStyles.nameCell }}>
              <span>{item.name}</span>
              <span className="trash-page__meta">
                {item.type === "FOLDER" ? t("nav.files") : item.mime_type ?? ""}
              </span>
            </div>
            <div className="trash-page__cell">{formatDate(item.deleted_at ?? item.updated_at)}</div>
            <div className="trash-page__cell">{formatSize(item.size_bytes)}</div>
            <div className="trash-page__cell">{item.owner_user_id ?? "-"}</div>
            <div className="trash-page__actions">
              <button
                type="button"
                className="trash-page__button"
                onClick={() => handleRestore(item.id)}
                disabled={actionId === item.id}
              >
                {t("action.restore")}
              </button>
              <button
                type="button"
                className="trash-page__button trash-page__button--danger"
                onClick={() => handleDelete(item.id)}
                disabled={actionId === item.id}
              >
                {t("action.deleteForever")}
              </button>
            </div>
          </div>
        ))}
      </div>
      {
        !loading && items.length === 0 && !errorKey ? (
          <EmptyState titleKey={t("msg.emptyTrash")} />
        ) : null
      }
      {
        errorKey === "err.forbidden" ? (
          <ForbiddenState
            titleKey={t("err.forbidden")}
            actionLabelKey={t("action.goHome")}
            onAction={() => window.location.href = "/"}
          />
        ) : errorKey ? (
          <ErrorState
            titleKey={t("err.unknown")}
            descKey={t(errorKey)}
            retryLabelKey={t("action.retry")}
            onRetry={() => window.location.reload()}
          />
        ) : null
      }
      {
        nextCursor ? (
          <button
            type="button"
            style={layoutStyles.loadMore}
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? `${t("action.loadMore")}…` : t("action.loadMore")}
          </button>
        ) : null
      }
    </section >
  );
}
