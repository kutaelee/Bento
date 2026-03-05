import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DataTableColumn,
  PageHeader,
  PatternDataTable,
  Toolbar,
  type PatternDataTableProps,
} from "@nimbus/ui-kit";
import { ROOT_NODE_ID } from "./nodes";
import { ApiError } from "../api/errors";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { SkeletonBlock, EmptyState, ErrorState, ForbiddenState } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import { getVisualState } from "./visualFixtures";
import { useViewPreferences } from "./useViewPreferences";
import { GridView } from "./GridView";
import { SelectionActionBar } from "./SelectionActionBar";
import { Button } from "@nimbus/ui-kit";

type RouteMode = "files" | "recent" | "favorites" | "shared" | "media" | "trash";

type FilesPageProps = {
  routeMode?: RouteMode;
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

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

type FolderViewProps = {
  title: string;
  metaLabelKey?: I18nKey;
  metaValue?: string | null;
  items: NodeItem[];
  nextCursor: string | null;
  loading: boolean;
  loadingMore: boolean;
  errorKey: I18nKey | null;
  selectedIds?: Set<string>;
  // Back-compat shim (older pages)
  selectedNodeId?: string;
  onSelectItem?: (item: NodeItem | null) => void;

  onToggleSelect?: (item: NodeItem, multi: boolean) => void;
  onLoadMore?: () => void;
  rowActionRenderer?: (item: NodeItem) => React.ReactNode;
  emptyKey?: I18nKey;
};

const layoutStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
  },
  meta: {
    color: "#6b7280",
    fontSize: 12,
  },
  table: {
    display: "grid",
    rowGap: 8,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1fr",
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
    color: "#6b7280",
    fontSize: 12,
  },
  nameCell: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  selectedRow: {
    background: "#eef2ff",
  },
};

export function FolderView({
  title,
  metaLabelKey,
  metaValue,
  items,
  nextCursor,
  loading,
  loadingMore,
  errorKey,
  selectedIds,
  onToggleSelect,
  onLoadMore,
  rowActionRenderer,
  emptyKey,
}: FolderViewProps) {
  const { prefs, setViewMode } = useViewPreferences();

  const getColDisplay = (colName: string) =>
    prefs.visibleColumns.includes(colName) ? "block" : "none";

  return (
    <section style={layoutStyles.wrapper}>
      <header style={{ ...layoutStyles.header, flexDirection: "row" as const, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={layoutStyles.title}>{title}</div>
          {metaValue ? (
            <div style={layoutStyles.meta}>
              {t(metaLabelKey ?? "field.path")}: {metaValue}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8 } as React.CSSProperties}>
          <Button
            variant={prefs.viewMode === "table" ? "primary" : "ghost"}
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          <Button
            variant={prefs.viewMode === "grid" ? "primary" : "ghost"}
            onClick={() => setViewMode("grid")}
          >
            Grid
          </Button>
        </div>
      </header>
      {prefs.viewMode === "grid" ? (
        <GridView
          items={items}
          loading={loading}
          selectedIds={selectedIds}
          onToggleSelect={onToggleSelect}
        />
      ) : (
        <div style={layoutStyles.table}>
          <div style={{ ...layoutStyles.row, background: "#f9fafb" }}>
            <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell }}>{t("field.name")}</div>
            <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell, display: getColDisplay("modifiedAt") }}>{t("field.modifiedAt")}</div>
            <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell, display: getColDisplay("size") }}>{t("field.size")}</div>
            <div style={{ ...layoutStyles.cell, ...layoutStyles.headCell, display: getColDisplay("owner") }}>{t("field.owner")}</div>
          </div>
          {loading && items.length === 0 ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={`skel-${i}`} style={layoutStyles.row}>
                  <SkeletonBlock height={20} width="80%" />
                  <SkeletonBlock height={20} width="60%" />
                  <SkeletonBlock height={20} width="40%" />
                  <SkeletonBlock height={20} width="50%" />
                </div>
              ))}
            </>
          ) : items.map((item) => {
            const isSelected = selectedIds?.has(item.id) ?? false;
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                style={{ ...layoutStyles.row, ...(isSelected ? layoutStyles.selectedRow : null) }}
                onClick={(event: React.MouseEvent) => onToggleSelect?.(item, event.metaKey || event.ctrlKey || event.shiftKey)}
                onKeyDown={(event: React.KeyboardEvent) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onToggleSelect?.(item, event.metaKey || event.ctrlKey || event.shiftKey);
                  }
                }}
              >
                <div style={{ ...layoutStyles.cell, ...layoutStyles.nameCell }}>
                  <span>{item.name}</span>
                  <span style={layoutStyles.meta}>
                    {item.type === "FOLDER" ? t("nav.files") : item.mime_type ?? ""}
                  </span>
                </div>
                <div style={{ ...layoutStyles.cell, display: getColDisplay("modifiedAt") }}>{formatDate(item.updated_at)}</div>
                <div style={{ ...layoutStyles.cell, display: getColDisplay("size") }}>{formatSize(item.size_bytes)}</div>
                <div style={{ ...layoutStyles.cell, display: getColDisplay("owner") }}>{item.owner_user_id ?? "-"}</div>
              </div>
            );
          })}
        </div>
      )}
      {!loading && items.length === 0 && !errorKey ? (
        <EmptyState titleKey={t(emptyKey ?? "msg.emptyFolder")} />
      ) : null}
      {errorKey === "err.forbidden" ? (
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
      ) : null}
      {nextCursor ? (
        <div className="files-view__footer">
          <button
            type="button"
            className="files-view__load-more"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? `${t("action.loadMore")}…` : t("action.loadMore")}
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function FilesPage({ routeMode = "files" }: FilesPageProps) {
  const { refreshToken, triggerRefresh } = useFolderRefresh();
  const { selectedNode, setSelectedNode } = useInspectorState();
  const { nodeId } = useParams();
  const isRootRoute = !nodeId;
  const isRecentRoute = routeMode === "recent";
  const isFavoritesRoute = routeMode === "favorites";
  const isSharedRoute = routeMode === "shared";
  const isMediaRoute = routeMode === "media";
  const isTrashRoute = routeMode === "trash";
  const visualState = getVisualState();
  const shouldLoadChildren = !isSharedRoute && !isTrashRoute;
  const resolvedNodeId = nodeId ?? ROOT_NODE_ID;

  const listChildrenSort = isRecentRoute || isFavoritesRoute ? "updated_at" : "name";
  const listChildrenOrder = isRecentRoute || isFavoritesRoute ? "desc" : "asc";

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

  const [node, setNode] = useState<NodeItem | null>(null);
  const [children, setChildren] = useState<NodeItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<I18nKey | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const loadMoreGeneration = useRef(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSelect = useCallback(
    (item: NodeItem, multi: boolean) => {
      setSelectedIds((prev: Set<string>) => {
        const next = new Set(multi ? prev : []);
        if (multi && prev.has(item.id)) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
        return next;
      });
      // Also update inspector to show single item if only 1 is selected
      if (!multi) {
        setSelectedNode(item);
      } else {
        setSelectedNode(null); // multi select implies no single inspector
      }
    },
    [setSelectedNode]
  );

  useEffect(() => {
    let active = true;

    setSelectedNode(null);
    setSelectedIds(new Set());

    if (visualState === "loading") {
      setLoading(true);
      setLoadingMore(false);
      setErrorKey(null);
      setNode(null);
      setChildren([]);
      setNextCursor(null);
      return () => {
        active = false;
      };
    }

    const load = async () => {
      setActionErrorKey(null);

      if (isTrashRoute) {
        setLoading(true);
        setLoadingMore(false);
        setErrorKey(null);
        setNode(null);
        setChildren([]);
        setNextCursor(null);

        try {
          const response = await nodesApi.listTrash({});
          if (!active) return;
          setChildren(response.items ?? []);
          setNextCursor(response.next_cursor ?? null);
        } catch (error) {
          if (!active) return;
          if (error instanceof ApiError) {
            setErrorKey(error.key);
          } else {
            setErrorKey("err.network");
          }
          setChildren([]);
          setNextCursor(null);
        } finally {
          if (active) setLoading(false);
        }
        return;
      }

      if (!shouldLoadChildren) {
        setLoading(false);
        setLoadingMore(false);
        setErrorKey(null);
        setNode(null);
        setChildren([]);
        setNextCursor(null);
        return;
      }

      setLoading(true);
      setLoadingMore(false);
      setErrorKey(null);
      setNode(null);
      setChildren([]);
      setNextCursor(null);

      try {
        const childrenResponse = await nodesApi.listChildren({
          nodeId: resolvedNodeId,
          sort: listChildrenSort,
          order: listChildrenOrder,
        });

        let nodeResponse: NodeItem | null = null;
        if (!isRootRoute) {
          nodeResponse = await nodesApi.getNode(resolvedNodeId);
        }

        if (!active) return;
        setNode(nodeResponse);
        setChildren(childrenResponse.items ?? []);
        setNextCursor(childrenResponse.next_cursor ?? null);
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError) {
          setErrorKey(error.key);
        } else {
          setErrorKey("err.network");
        }
        setNode(null);
        setChildren([]);
        setNextCursor(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [
    nodesApi,
    refreshToken,
    resolvedNodeId,
    isSharedRoute,
    isTrashRoute,
    shouldLoadChildren,
    setSelectedNode,
    listChildrenSort,
    listChildrenOrder,
    visualState,
  ]);

  useEffect(() => {
    return () => {
      setSelectedNode(null);
    };
  }, [setSelectedNode]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const requestToken = (loadMoreGeneration.current += 1);
    setLoadingMore(true);
    setErrorKey(null);
    try {
      const response = await nodesApi.listChildren({
        nodeId: resolvedNodeId,
        cursor: nextCursor,
      });
      setChildren((prev: NodeItem[]) => [...prev, ...response.items]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (requestToken !== loadMoreGeneration.current) return;
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
    } finally {
      if (requestToken === loadMoreGeneration.current) {
        setLoadingMore(false);
      }
    }
  }, [
    nextCursor,
    nodesApi,
    isTrashRoute,
    resolvedNodeId,
    listChildrenSort,
    listChildrenOrder,
  ]);

  const handleRestore = useCallback(
    async (itemId: string) => {
      if (actionId) return;
      setActionId(itemId);
      setActionErrorKey(null);
      try {
        await nodesApi.restoreTrash({ nodeId: itemId });
        setChildren((prev) => prev.filter((item) => item.id !== itemId));
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
    async (itemId: string) => {
      if (actionId) return;
      setActionId(itemId);
      setActionErrorKey(null);
      try {
        await nodesApi.deleteTrash({ nodeId: itemId });
        setChildren((prev) => prev.filter((item) => item.id !== itemId));
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

  const renderTrashActions = useCallback(
    (item: NodeItem) => {
      if (!isTrashRoute) return null;

      return (
        <div className="files-view__action-group">
          <button
            type="button"
            className="files-view__action-button"
            onClick={() => handleRestore(item.id)}
            disabled={!!actionId}
          >
            {t("action.restore")}
          </button>
          <button
            type="button"
            className="files-view__action-button files-view__action-button--danger"
            onClick={() => handleDelete(item.id)}
            disabled={!!actionId}
          >
            {t("action.deleteForever")}
          </button>
        </div>
      );
    },
    [actionId, handleRestore, handleDelete, isTrashRoute],
  );

  const title =
    isTrashRoute
      ? t("nav.trash")
      : isRecentRoute
        ? t("nav.recent")
        : isFavoritesRoute
          ? t("nav.favorites")
          : isSharedRoute
            ? t("nav.shared")
            : isMediaRoute
              ? t("nav.media")
              : isRootRoute
                ? t("nav.files")
                : node?.name ?? t("nav.files");

  const pageMetaLabelKey = isRecentRoute ? "field.modifiedAt" : "field.path";

  const pageEmptyKey = isRecentRoute
    ? "msg.emptyRecent"
    : isFavoritesRoute
      ? "msg.emptyFavorites"
      : isSharedRoute
        ? "msg.emptyShared"
        : isMediaRoute
          ? "msg.emptyFolder"
          : isTrashRoute
            ? "msg.emptyTrash"
            : undefined;

  return (
    <>
      <FolderView
        title={title}
        metaLabelKey="field.path"
        metaValue={isRootRoute ? null : node?.path ?? null}
        items={children}
        nextCursor={nextCursor}
        loading={loading}
        loadingMore={loadingMore}
        errorKey={errorKey}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onLoadMore={loadMore}
      />
      <SelectionActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onDownload={selectedIds.size > 0 ? () => alert("Not implemented") : undefined}
        onDelete={selectedIds.size > 0 ? () => alert("Not implemented") : undefined}
        onMove={selectedIds.size > 0 ? () => alert("Not implemented") : undefined}
      />
    </>
  );
}
