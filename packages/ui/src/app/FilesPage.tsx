import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Dialog, EmptyState, ErrorState, ForbiddenState, SkeletonBlock } from "@nimbus/ui-kit";
import { ROOT_NODE_ID } from "./nodes";
import { ApiError } from "../api/errors";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import { getVisualState } from "./visualFixtures";
import { useViewPreferences } from "./useViewPreferences";
import { GridView } from "./GridView";
import { SelectionActionBar } from "./SelectionActionBar";
import { useUploadQueue } from "./uploadQueue";
import { downloadBlob, formatBytes, formatDate } from "./format";
import "./FilesPage.css";

type RouteMode = "files" | "recent" | "favorites" | "shared" | "media" | "trash";

type FilesPageProps = {
  routeMode?: RouteMode;
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
  onToggleSelect?: (item: NodeItem, multi: boolean) => void;
  onLoadMore?: () => void;
  rowActionRenderer?: (item: NodeItem) => React.ReactNode;
  emptyKey?: I18nKey;
  onOpenItem?: (item: NodeItem) => void;
  routeMode?: RouteMode;
  onRetry?: () => void;
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
  onOpenItem,
  routeMode = "files",
  onRetry,
}: FolderViewProps) {
  const navigate = useNavigate();
  const { prefs, setViewMode } = useViewPreferences();
  const hasRowActions = Boolean(rowActionRenderer);

  if (errorKey === "err.forbidden") {
    return (
      <ForbiddenState
        titleKey={t("err.forbidden")}
        descKey={t("msg.forbiddenAdmin")}
        actionLabelKey={t("action.goHome")}
        onAction={() => navigate("/files")}
      />
    );
  }

  if (errorKey) {
    return (
      <ErrorState
        titleKey={t("err.unknown")}
        descKey={t(errorKey)}
        retryLabelKey={t("action.retry")}
        onRetry={onRetry}
      />
    );
  }

  return (
    <section className="files-page__table-shell">
      <header className="files-page__section-head">
        <div>
          <h2 className="files-page__section-title">{title}</h2>
          {metaValue ? <p className="files-page__section-meta">{t(metaLabelKey ?? "field.path")}: {metaValue}</p> : null}
        </div>
        <div className="files-page__view-toggle" role="tablist" aria-label={t("msg.filesViewToggle")}> 
          <Button variant={prefs.viewMode === "table" ? "primary" : "ghost"} onClick={() => setViewMode("table")}>{t("action.viewTable")}</Button>
          <Button variant={prefs.viewMode === "grid" ? "primary" : "ghost"} onClick={() => setViewMode("grid")}>{t("action.viewGrid")}</Button>
        </div>
      </header>

      {prefs.viewMode === "grid" ? (
        <GridView items={items} loading={loading} selectedIds={selectedIds} onToggleSelect={onToggleSelect} onOpenItem={onOpenItem} />
      ) : (
        <div className="files-page__table">
          <div className={`files-page__row files-page__row--head${hasRowActions ? " files-page__row--actionable" : ""}`}>
            <div>{t("field.name")}</div>
            <div>{t(routeMode === "trash" ? "field.expiry" : "field.modifiedAt")}</div>
            <div>{t("field.size")}</div>
            <div>{t("field.owner")}</div>
            {hasRowActions ? <div>{t("field.status")}</div> : null}
          </div>
          {loading && items.length === 0 ? (
            [1, 2, 3, 4].map((i) => (
              <div key={`files-skeleton-${i}`} className={`files-page__row${hasRowActions ? " files-page__row--actionable" : ""}`}>
                <SkeletonBlock height={18} width="80%" />
                <SkeletonBlock height={18} width="70%" />
                <SkeletonBlock height={18} width="50%" />
                <SkeletonBlock height={18} width="50%" />
                {hasRowActions ? <SkeletonBlock height={18} width="80%" /> : null}
              </div>
            ))
          ) : items.map((item) => {
            const isSelected = selectedIds?.has(item.id) ?? false;
            const metaLine = routeMode === "trash"
              ? formatDate(item.deleted_at ?? item.updated_at)
              : routeMode === "files"
                ? (item.type === "FOLDER" ? t("nav.files") : item.mime_type ?? "-")
                : item.path;

            return (
              <div key={item.id} className={`files-page__row${hasRowActions ? " files-page__row--actionable" : ""}${isSelected ? " files-page__row--selected" : ""}`}>
                <button
                  type="button"
                  className="files-page__row-button"
                  onClick={(event) => onToggleSelect?.(item, event.metaKey || event.ctrlKey || event.shiftKey)}
                  onDoubleClick={() => onOpenItem?.(item)}
                >
                  <span className="files-page__name">{item.name}</span>
                  <span className="files-page__name-meta">{metaLine}</span>
                </button>
                <div>{formatDate(routeMode === "trash" ? item.deleted_at ?? item.updated_at : item.updated_at)}</div>
                <div>{formatBytes(item.size_bytes)}</div>
                <div>{item.owner_user_id ?? "-"}</div>
                {hasRowActions ? <div className="files-page__row-actions">{rowActionRenderer?.(item)}</div> : null}
              </div>
            );
          })}
        </div>
      )}

      {!loading && items.length === 0 ? <EmptyState titleKey={t(emptyKey ?? "msg.emptyFolder")} descKey={t("msg.filesEmptyHint")} /> : null}

      {nextCursor ? (
        <div className="files-page__footer">
          <Button variant="ghost" onClick={onLoadMore} disabled={loadingMore}>{loadingMore ? t("msg.loading") : t("action.loadMore")}</Button>
        </div>
      ) : null}
    </section>
  );
}

export function FilesPage({ routeMode = "files" }: FilesPageProps) {
  const navigate = useNavigate();
  const { refreshToken, triggerRefresh } = useFolderRefresh();
  const { selectedNode, setSelectedNode } = useInspectorState();
  const { items: uploadItems } = useUploadQueue();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmMode, setConfirmMode] = useState<"delete" | "deleteForever" | null>(null);
  const loadMoreGeneration = useRef(0);

  const selectedItems = children.filter((item) => selectedIds.has(item.id));
  const pendingUploads = uploadItems.filter((item) => item.status !== "COMPLETED");

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

  const pageEmptyKey = isRecentRoute
    ? "msg.emptyRecent"
    : isFavoritesRoute
      ? "msg.emptyFavorites"
      : isSharedRoute
        ? "msg.emptyShared"
        : isMediaRoute
          ? "msg.emptyMedia"
          : isTrashRoute
            ? "msg.emptyTrash"
            : undefined;

  const runLoad = useCallback(async () => {
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
        setChildren(response.items ?? []);
        setNextCursor(response.next_cursor ?? null);
      } catch (error) {
        if (error instanceof ApiError) {
          setErrorKey(error.key);
        } else {
          setErrorKey("err.network");
        }
        setChildren([]);
        setNextCursor(null);
      } finally {
        setLoading(false);
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

      setNode(nodeResponse);
      setChildren(childrenResponse.items ?? []);
      setNextCursor(childrenResponse.next_cursor ?? null);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorKey(error.key);
      } else {
        setErrorKey("err.network");
      }
      setNode(null);
      setChildren([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [isRootRoute, isTrashRoute, listChildrenOrder, listChildrenSort, nodesApi, resolvedNodeId, shouldLoadChildren]);

  useEffect(() => {
    let active = true;
    void refreshToken;

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

    void (async () => {
      if (!active) return;
      await runLoad();
    })();

    return () => {
      active = false;
    };
  }, [refreshToken, runLoad, setSelectedNode, visualState]);

  useEffect(() => () => setSelectedNode(null), [setSelectedNode]);

  const handleToggleSelect = useCallback((item: NodeItem, multi: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(multi ? prev : []);
      if (multi && prev.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });

    if (!multi) {
      setSelectedNode(item);
    } else {
      setSelectedNode(null);
    }
  }, [setSelectedNode]);

  const openItem = useCallback(async (item: NodeItem) => {
    if (item.type === "FOLDER") {
      navigate(item.id === ROOT_NODE_ID ? "/files" : `/files/${item.id}`);
      return;
    }

    try {
      const blob = await nodesApi.downloadNode({ nodeId: item.id });
      await downloadBlob(blob, item.name);
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    }
  }, [navigate, nodesApi]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    loadMoreGeneration.current += 1;
    const requestToken = loadMoreGeneration.current;
    setLoadingMore(true);
    setErrorKey(null);
    try {
      const response = isTrashRoute
        ? await nodesApi.listTrash({ cursor: nextCursor })
        : await nodesApi.listChildren({ nodeId: resolvedNodeId, cursor: nextCursor, sort: listChildrenSort, order: listChildrenOrder });
      if (requestToken !== loadMoreGeneration.current) return;
      setChildren((prev) => [...prev, ...(response.items ?? [])]);
      setNextCursor(response.next_cursor ?? null);
    } catch (error) {
      if (requestToken !== loadMoreGeneration.current) return;
      setErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      if (requestToken === loadMoreGeneration.current) {
        setLoadingMore(false);
      }
    }
  }, [isTrashRoute, listChildrenOrder, listChildrenSort, nextCursor, nodesApi, resolvedNodeId]);

  const applyTrashRestore = useCallback(async (itemIds: string[]) => {
    setActionId(itemIds[0] ?? null);
    setActionErrorKey(null);
    try {
      for (const itemId of itemIds) {
        await nodesApi.restoreTrash({ nodeId: itemId });
      }
      setChildren((prev) => prev.filter((item) => !itemIds.includes(item.id)));
      setSelectedIds(new Set());
      triggerRefresh();
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionId(null);
    }
  }, [nodesApi, triggerRefresh]);

  const confirmDelete = useCallback(async () => {
    const itemIds = Array.from(selectedIds);
    if (!itemIds.length || !confirmMode) return;

    setActionId(itemIds[0]);
    setActionErrorKey(null);
    try {
      for (const itemId of itemIds) {
        if (confirmMode === "deleteForever" || isTrashRoute) {
          await nodesApi.deleteTrash({ nodeId: itemId });
        } else {
          await nodesApi.deleteNode({ nodeId: itemId });
        }
      }
      setChildren((prev) => prev.filter((item) => !itemIds.includes(item.id)));
      setSelectedIds(new Set());
      setConfirmMode(null);
      triggerRefresh();
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionId(null);
    }
  }, [confirmMode, isTrashRoute, nodesApi, selectedIds, triggerRefresh]);

  const handleDownloadSelected = useCallback(async () => {
    setActionErrorKey(null);
    try {
      for (const item of selectedItems) {
        if (item.type === "FOLDER") continue;
        const blob = await nodesApi.downloadNode({ nodeId: item.id });
        await downloadBlob(blob, item.name);
      }
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    }
  }, [nodesApi, selectedItems]);

  const renderTrashActions = useCallback((item: NodeItem) => {
    if (!isTrashRoute) return null;

    return (
      <>
        <Button variant="ghost" onClick={() => void applyTrashRestore([item.id])} disabled={!!actionId}>{t("action.restore")}</Button>
        <Button variant="ghost" onClick={() => { setSelectedIds(new Set([item.id])); setConfirmMode("deleteForever"); }} disabled={!!actionId}>{t("action.deleteForever")}</Button>
      </>
    );
  }, [actionId, applyTrashRestore, isTrashRoute]);

  const summaryCards = [
    { label: t("msg.filesSummaryItems"), value: String(children.length), tone: "default" },
    { label: t("msg.filesSummarySelected"), value: String(selectedIds.size), tone: selectedIds.size ? "accent" : "default" },
    { label: t("msg.filesSummaryUploads"), value: String(pendingUploads.length), tone: pendingUploads.length ? "accent" : "default" },
    { label: t("msg.filesSummaryFolder"), value: isRootRoute ? t("nav.files") : (node?.name ?? t("nav.files")), tone: "default" },
  ];

  return (
    <section className="files-page">
      <header className="files-page__hero">
        <div className="files-page__hero-copy">
          <p className="files-page__eyebrow">{isTrashRoute ? t("nav.trash") : t("nav.files")}</p>
          <h1 className="files-page__title">{title}</h1>
          <p className="files-page__description">{isTrashRoute ? t("msg.trashDescription") : t("msg.filesDescription")}</p>
        </div>
        <div className="files-page__hero-actions">
          <Button variant="ghost" onClick={() => void runLoad()}>{t("action.refresh")}</Button>
          {!isTrashRoute ? <Button variant="primary" onClick={() => navigate("/search")}>{t("field.search")}</Button> : null}
        </div>
      </header>

      <section className="files-page__summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className={`files-page__summary-card${card.tone === "accent" ? " files-page__summary-card--accent" : ""}`}>
            <span className="files-page__summary-label">{card.label}</span>
            <strong className="files-page__summary-value">{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="files-page__layout">
        <div className="files-page__main-column">
          {actionErrorKey ? <div className="files-page__banner files-page__banner--error">{t(actionErrorKey)}</div> : null}
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
            rowActionRenderer={isTrashRoute ? renderTrashActions : undefined}
            emptyKey={pageEmptyKey}
            onOpenItem={openItem}
            routeMode={routeMode}
            onRetry={() => void runLoad()}
          />
        </div>

        <aside className="files-page__aside">
          <article className="files-page__panel">
            <h2 className="files-page__panel-title">{t("msg.filesQuickActionsTitle")}</h2>
            <p className="files-page__panel-copy">{t("msg.filesQuickActionsBody")}</p>
            <div className="files-page__panel-actions">
              {!isTrashRoute ? <Button variant="ghost" onClick={() => navigate("/search")}>{t("field.search")}</Button> : null}
              <Button variant="ghost" onClick={() => void runLoad()}>{t("action.refresh")}</Button>
              {isTrashRoute && selectedIds.size > 0 ? <Button variant="ghost" onClick={() => void applyTrashRestore(Array.from(selectedIds))}>{t("action.restore")}</Button> : null}
            </div>
          </article>

          <article className="files-page__panel">
            <h2 className="files-page__panel-title">{t("msg.filesActivityTitle")}</h2>
            <div className="files-page__activity-list">
              {pendingUploads.length ? pendingUploads.slice(0, 4).map((item) => (
                <div key={item.id} className="files-page__activity-item">
                  <strong>{item.file.name}</strong>
                  <span>{t("status.jobRunning")}</span>
                </div>
              )) : <p className="files-page__panel-copy">{t("msg.filesActivityEmpty")}</p>}
            </div>
          </article>

          <article className="files-page__panel">
            <h2 className="files-page__panel-title">{t("msg.filesSelectionTitle")}</h2>
            <p className="files-page__panel-copy">
              {selectedNode ? selectedNode.name : selectedIds.size ? t("msg.filesSelectionMany").replace("{n}", String(selectedIds.size)) : t("msg.selectItem")}
            </p>
          </article>
        </aside>
      </section>

      <SelectionActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onDownload={selectedItems.some((item) => item.type !== "FOLDER") ? () => void handleDownloadSelected() : undefined}
        onDelete={selectedIds.size > 0 ? () => setConfirmMode(isTrashRoute ? "deleteForever" : "delete") : undefined}
        onRestore={isTrashRoute && selectedIds.size > 0 ? () => void applyTrashRestore(Array.from(selectedIds)) : undefined}
      />

      <Dialog
        open={confirmMode !== null}
        title={confirmMode === "deleteForever" ? t("modal.deleteForever.title") : t("modal.delete.title")}
        onClose={() => { if (!actionId) setConfirmMode(null); }}
        closeLabel={t("action.close")}
        footer={
          <div className="nd-dialog__actions">
            <Button variant="ghost" onClick={() => setConfirmMode(null)} disabled={!!actionId}>{t("action.cancel")}</Button>
            <Button variant="primary" onClick={() => void confirmDelete()} loading={!!actionId}>{confirmMode === "deleteForever" ? t("action.deleteForever") : t("action.delete")}</Button>
          </div>
        }
      >
        <p>{confirmMode === "deleteForever" ? t("modal.deleteForever.desc") : t("modal.delete.desc")}</p>
      </Dialog>
    </section>
  );
}

