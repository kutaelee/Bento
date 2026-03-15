import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Dialog, EmptyState, ErrorState, ForbiddenState, SkeletonBlock } from "@nimbus/ui-kit";
import { ROOT_NODE_ID } from "./nodes";
import { ApiError } from "../api/errors";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { createMePreferencesApi } from "../api/mePreferences";
import { createVolumesApi } from "../api/volumes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import { getVisualFixtureSearch, getVisualState } from "./visualFixtures";
import { useViewPreferences } from "./useViewPreferences";
import { GridView } from "./GridView";
import { SelectionActionBar } from "./SelectionActionBar";
import { useUploadQueue } from "./uploadQueue";
import { downloadBlob, formatBytes, formatDate } from "./format";
import { useNodeFavorites } from "./useNodeFavorites";
import { Breadcrumbs } from "./Breadcrumbs";
import { FileTypeIcon } from "./FileTypeIcon";
import { FavoriteIcon } from "./FavoriteIcon";
import { buildChildDisplayPath, buildDisplayPath, formatOwnerLabel, type UserIdentity } from "./nodePresentation";
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
  ownerLabel?: (ownerUserId?: string | null) => string;
  itemPathLabel?: (item: NodeItem) => string;
  dropTargetId?: string | null;
  onToggleSelect?: (item: NodeItem, modifiers: { multi: boolean; range: boolean }) => void;
  onLoadMore?: () => void;
  rowActionRenderer?: (item: NodeItem) => React.ReactNode;
  emptyKey?: I18nKey;
  onOpenItem?: (item: NodeItem) => void;
  routeMode?: RouteMode;
  onRetry?: () => void;
  favoriteIds?: Set<string>;
  onToggleFavorite?: (item: NodeItem) => void;
  onStartDrag?: (item: NodeItem, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragOverFolder?: (item: NodeItem, event: React.DragEvent<HTMLElement>) => void;
  onDragLeaveFolder?: (item: NodeItem) => void;
  onDropOnFolder?: (item: NodeItem, event: React.DragEvent<HTMLElement>) => void;
};

const DND_SELECTION_TYPE = "application/x-bento-node-selection";

function setDraggedData(event: React.DragEvent<HTMLElement>, itemIds: string[]) {
  const payload = JSON.stringify(itemIds);
  event.dataTransfer.effectAllowed = "copyMove";
  event.dataTransfer.setData(DND_SELECTION_TYPE, payload);
  event.dataTransfer.setData("text/plain", payload);
}

function readDraggedIds(event: React.DragEvent<HTMLElement>) {
  const raw = event.dataTransfer.getData(DND_SELECTION_TYPE) || event.dataTransfer.getData("text/plain");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

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
  ownerLabel,
  itemPathLabel,
  dropTargetId,
  onToggleSelect,
  onLoadMore,
  rowActionRenderer,
  emptyKey,
  onOpenItem,
  routeMode = "files",
  onRetry,
  favoriteIds,
  onToggleFavorite,
  onStartDrag,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: FolderViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
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
          <button
            type="button"
            className={prefs.viewMode === "table" ? "files-page__view-button files-page__view-button--active" : "files-page__view-button"}
            onClick={() => setViewMode("table")}
          >
            <span className="files-page__view-button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 7h13M7 12h13M7 17h13M4 7h.01M4 12h.01M4 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <span>{t("action.viewTable")}</span>
          </button>
          <button
            type="button"
            className={prefs.viewMode === "grid" ? "files-page__view-button files-page__view-button--active" : "files-page__view-button"}
            onClick={() => setViewMode("grid")}
          >
            <span className="files-page__view-button-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="4" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.8" />
                <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.8" />
                <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.8" />
                <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.25" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </span>
            <span>{t("action.viewGrid")}</span>
          </button>
        </div>
      </header>

      {prefs.viewMode === "grid" ? (
        <GridView
          items={items}
          loading={loading}
          selectedIds={selectedIds}
          favoriteIds={favoriteIds}
          dropTargetId={dropTargetId}
          onToggleSelect={onToggleSelect}
          onOpenItem={onOpenItem}
          onToggleFavorite={onToggleFavorite}
          onStartDrag={onStartDrag}
          onDragOverFolder={onDragOverFolder}
          onDragLeaveFolder={onDragLeaveFolder}
          onDropOnFolder={onDropOnFolder}
        />
      ) : (
        <div className="files-page__table-wrap">
          <table className="files-page__table">
            <thead>
              <tr>
                <th>{t("field.name")}</th>
                <th>{t(routeMode === "trash" ? "field.expiry" : "field.modifiedAt")}</th>
                <th>{t("field.owner")}</th>
                <th>{t("field.size")}</th>
                {hasRowActions ? <th>{t("field.status")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                [1, 2, 3, 4].map((i) => (
                  <tr key={`files-skeleton-${i}`}>
                    <td><SkeletonBlock height={18} width="80%" /></td>
                    <td><SkeletonBlock height={18} width="70%" /></td>
                    <td><SkeletonBlock height={18} width="50%" /></td>
                    <td><SkeletonBlock height={18} width="50%" /></td>
                    {hasRowActions ? <td><SkeletonBlock height={18} width="80%" /></td> : null}
                  </tr>
                ))
              ) : items.map((item) => {
                const isSelected = selectedIds?.has(item.id) ?? false;
                const isDropTarget = dropTargetId === item.id;
                const metaLine = routeMode === "trash"
                  ? formatDate(item.deleted_at ?? item.updated_at)
                  : routeMode === "files"
                    ? (item.type === "FOLDER" ? t("nav.files") : item.mime_type ?? "-")
                    : itemPathLabel?.(item) ?? item.path;

                return (
                  <tr
                    key={item.id}
                    className={[
                      "files-page__row",
                      isSelected ? "files-page__row--selected" : "",
                      isDropTarget ? "files-page__row--drop-target" : "",
                    ].filter(Boolean).join(" ")}
                    onDragOver={(event) => {
                      if (item.type !== "FOLDER") return;
                      onDragOverFolder?.(item, event);
                    }}
                    onDragLeave={() => {
                      if (item.type !== "FOLDER") return;
                      onDragLeaveFolder?.(item);
                    }}
                    onDrop={(event) => {
                      if (item.type !== "FOLDER") return;
                      onDropOnFolder?.(item, event);
                    }}
                  >
                    <td>
                      <div className="files-page__name-cell">
                        <button
                          type="button"
                          className="files-page__row-button"
                          draggable={Boolean(onStartDrag)}
                          onClick={(event) => onToggleSelect?.(item, {
                            multi: event.metaKey || event.ctrlKey || event.shiftKey,
                            range: event.shiftKey,
                          })}
                          onDoubleClick={() => onOpenItem?.(item)}
                          onDragStart={(event) => onStartDrag?.(item, event)}
                        >
                          <FileTypeIcon item={item} className="files-page__name-icon" />
                          <span className="files-page__name-content">
                            <strong className="files-page__name">{item.name}</strong>
                            <span className="files-page__name-meta">{metaLine}</span>
                          </span>
                        </button>
                        <div className="files-page__name-tools">
                          <button type="button" className="files-page__open-trigger" onClick={() => onOpenItem?.(item)}>
                            {t("action.open")}
                          </button>
                          {onToggleFavorite ? (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={favoriteIds?.has(item.id) ? t("action.removeFavorite") : t("action.favorite")}
                              className={favoriteIds?.has(item.id) ? "files-page__favorite files-page__favorite--active" : "files-page__favorite"}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onToggleFavorite(item);
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                event.stopPropagation();
                                onToggleFavorite(item);
                              }}
                            >
                              <FavoriteIcon active={favoriteIds?.has(item.id)} className="files-page__favorite-icon" />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(routeMode === "trash" ? item.deleted_at ?? item.updated_at : item.updated_at)}</td>
                    <td>{ownerLabel ? ownerLabel(item.owner_user_id) : item.owner_user_id ?? "-"}</td>
                    <td className="files-page__size-cell">{formatBytes(item.size_bytes)}</td>
                    {hasRowActions ? <td className="files-page__row-actions">{rowActionRenderer?.(item)}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
  const preservedSearch = useMemo(() => getVisualFixtureSearch(location.search), [location.search]);
  const shouldLoadChildren = !isSharedRoute && !isTrashRoute;
  const resolvedNodeId = nodeId ?? ROOT_NODE_ID;

  const listChildrenSort = isRecentRoute || isFavoritesRoute ? "updated_at" : "name";
  const listChildrenOrder = isRecentRoute || isFavoritesRoute ? "desc" : "asc";

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);
  const meApi = useMemo(() => createMePreferencesApi(apiClient), [apiClient]);
  const volumesApi = useMemo(() => createVolumesApi(apiClient), [apiClient]);

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
  const [activeBasePath, setActiveBasePath] = useState<string>("/");
  const [currentPathLabel, setCurrentPathLabel] = useState<string>("/");
  const [currentUser, setCurrentUser] = useState<UserIdentity | null>(null);
  const [hoverDropTargetId, setHoverDropTargetId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<NodeItem | null>(null);
  const [transferItemIds, setTransferItemIds] = useState<string[]>([]);
  const [transferMode, setTransferMode] = useState<"move" | "copy" | null>(null);
  const [transferErrorKey, setTransferErrorKey] = useState<I18nKey | null>(null);
  const loadMoreGeneration = useRef(0);
  const selectionAnchorIdRef = useRef<string | null>(null);
  const { favorites, favoriteIds, toggleFavorite, syncFavorites } = useNodeFavorites();

  const displayItems = isFavoritesRoute ? favorites : children;
  const selectedItems = displayItems.filter((item) => selectedIds.has(item.id));
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

    if (isFavoritesRoute) {
      setLoading(false);
      setLoadingMore(false);
      setErrorKey(null);
      setNode(null);
      setChildren([]);
      setNextCursor(null);
      return;
    }

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
        setErrorKey(error instanceof ApiError ? error.key : "err.network");
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
      setErrorKey(error instanceof ApiError ? error.key : "err.network");
      setNode(null);
      setChildren([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }, [isFavoritesRoute, isRootRoute, isTrashRoute, listChildrenOrder, listChildrenSort, nodesApi, resolvedNodeId, shouldLoadChildren]);

  useEffect(() => {
    let active = true;
    void refreshToken;

    setSelectedNode(null);
    setSelectedIds(new Set());
    setHoverDropTargetId(null);
    setTransferTarget(null);
    setTransferItemIds([]);

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

  useEffect(() => {
    syncFavorites(children);
  }, [children, syncFavorites]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const me = await meApi.getPreferences();
        if (!active) return;
        setCurrentUser({
          id: String(me.id),
          username: me.username,
          display_name: me.display_name,
        });
      } catch {
        if (!active) return;
        setCurrentUser(null);
      }
    })();

    return () => {
      active = false;
    };
  }, [meApi]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await volumesApi.listVolumes();
        if (!active) return;
        const activeVolume = response.items.find((item) => item.is_active);
        setActiveBasePath(activeVolume?.base_path ?? "/");
      } catch {
        if (!active) return;
        setActiveBasePath("/");
      }
    })();

    return () => {
      active = false;
    };
  }, [volumesApi]);

  useEffect(() => {
    let active = true;

    if (routeMode !== "files") {
      setCurrentPathLabel("");
      return () => {
        active = false;
      };
    }

    if (isRootRoute) {
      setCurrentPathLabel(activeBasePath);
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const response = await nodesApi.getBreadcrumb(resolvedNodeId);
        if (!active) return;
        setCurrentPathLabel(buildDisplayPath(activeBasePath, response.items ?? []));
      } catch {
        if (!active) return;
        setCurrentPathLabel(activeBasePath);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeBasePath, isRootRoute, nodesApi, resolvedNodeId, routeMode]);

  const handleToggleSelect = useCallback((item: NodeItem, modifiers: { multi: boolean; range: boolean }) => {
    setSelectedIds((prev) => {
      if (modifiers.range && selectionAnchorIdRef.current) {
        const orderedIds = displayItems.map((entry) => entry.id);
        const anchorIndex = orderedIds.indexOf(selectionAnchorIdRef.current);
        const targetIndex = orderedIds.indexOf(item.id);
        if (anchorIndex !== -1 && targetIndex !== -1) {
          const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
          const next = new Set(modifiers.multi ? prev : []);
          orderedIds.slice(start, end + 1).forEach((id) => next.add(id));
          return next;
        }
      }

      const next = new Set(modifiers.multi ? prev : []);
      if (modifiers.multi && prev.has(item.id) && !modifiers.range) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });

    selectionAnchorIdRef.current = item.id;
    if (!modifiers.multi) {
      setSelectedNode(item);
    } else {
      setSelectedNode(null);
    }
  }, [displayItems, setSelectedNode]);

  const openItem = useCallback(async (item: NodeItem) => {
    if (item.type === "FOLDER") {
      navigate({
        pathname: item.id === ROOT_NODE_ID ? "/files" : `/files/${item.id}`,
        search: preservedSearch,
      });
      return;
    }

    try {
      const blob = await nodesApi.downloadNode({ nodeId: item.id });
      await downloadBlob(blob, item.name);
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    }
  }, [navigate, nodesApi, preservedSearch]);

  const ownerLabel = useCallback((ownerUserId?: string | null) => (
    formatOwnerLabel(ownerUserId, currentUser, new Map())
  ), [currentUser]);

  const itemPathLabel = useCallback((item: NodeItem) => {
    if (routeMode === "files") {
      return buildChildDisplayPath(currentPathLabel, item.name);
    }
    return item.path;
  }, [currentPathLabel, routeMode]);

  const handleStartDrag = useCallback((item: NodeItem, event: React.DragEvent<HTMLButtonElement>) => {
    const nextIds = selectedIds.has(item.id) ? Array.from(selectedIds) : [item.id];
    if (!selectedIds.has(item.id)) {
      setSelectedIds(new Set([item.id]));
      setSelectedNode(item);
      selectionAnchorIdRef.current = item.id;
    }
    setDraggedData(event, nextIds);
    setTransferItemIds(nextIds);
  }, [selectedIds, setSelectedNode]);

  const handleDragOverFolder = useCallback((item: NodeItem, event: React.DragEvent<HTMLElement>) => {
    const hasDraggedSelection = Array.from(event.dataTransfer.types).includes(DND_SELECTION_TYPE) || transferItemIds.length > 0;
    if (!hasDraggedSelection) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = event.ctrlKey || event.altKey ? "copy" : "move";
    setHoverDropTargetId(item.id);
  }, [transferItemIds.length]);

  const handleDragLeaveFolder = useCallback((item: NodeItem) => {
    setHoverDropTargetId((prev) => (prev === item.id ? null : prev));
  }, []);

  const handleDropOnFolder = useCallback((item: NodeItem, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    const droppedIds = readDraggedIds(event);
    const nextIds = droppedIds.length ? droppedIds : transferItemIds;
    if (!nextIds.length) return;
    setHoverDropTargetId(null);
    setTransferItemIds(nextIds);
    setTransferErrorKey(null);
    setTransferMode(null);
    setTransferTarget(item);
  }, [transferItemIds]);

  const applyTransfer = useCallback(async (mode: "move" | "copy") => {
    if (!transferTarget || transferItemIds.length === 0) return;
    if (transferItemIds.includes(transferTarget.id)) {
      setTransferErrorKey("err.validation");
      return;
    }

    setActionId(transferItemIds[0]);
    setActionErrorKey(null);
    setTransferErrorKey(null);
    setTransferMode(mode);

    try {
      for (const itemId of transferItemIds) {
        if (mode === "copy") {
          await nodesApi.copyNode({ nodeId: itemId, destinationParentId: transferTarget.id });
        } else {
          await nodesApi.moveNode({ nodeId: itemId, destinationParentId: transferTarget.id });
        }
      }
      setSelectedIds(new Set());
      setSelectedNode(null);
      selectionAnchorIdRef.current = null;
      setTransferItemIds([]);
      setTransferTarget(null);
      setTransferMode(null);
      await runLoad();
      triggerRefresh();
    } catch (error) {
      setTransferErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionId(null);
      setTransferMode(null);
    }
  }, [nodesApi, runLoad, transferItemIds, transferTarget, triggerRefresh, setSelectedNode]);

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

  const renderFileActions = useCallback((item: NodeItem) => {
    if (isTrashRoute) return null;

    return (
      <Button
        variant="ghost"
        className="files-page__delete-trigger"
        onClick={() => {
          setSelectedIds(new Set([item.id]));
          setConfirmMode("delete");
        }}
        disabled={!!actionId}
      >
        {t("action.delete")}
      </Button>
    );
  }, [actionId, isTrashRoute]);

  return (
    <section className="files-page">
      <div className="files-page__summary-strip">
        <article className="files-page__summary-card">
          <span>{t("msg.filesSummaryItems")}</span>
          <strong>{displayItems.length}</strong>
        </article>
        <article className="files-page__summary-card">
          <span>{t("msg.filesSummarySelected")}</span>
          <strong>{selectedIds.size}</strong>
        </article>
        <article className="files-page__summary-card">
          <span>{t("msg.filesSummaryUploads")}</span>
          <strong>{pendingUploads.length}</strong>
        </article>
        <article className="files-page__summary-card">
          <span>{t("msg.filesSummaryFolder")}</span>
          <strong>{isRootRoute ? t("nav.files") : (node?.name ?? t("nav.files"))}</strong>
        </article>
      </div>

      <header className="files-page__content-header">
        <div className="files-page__breadcrumbs">
          {routeMode === "files" ? <Breadcrumbs /> : <span className="files-page__breadcrumb files-page__breadcrumb--active">{title}</span>}
        </div>
        <div className="files-page__toolbar">
          {!isRootRoute && routeMode === "files" ? (
            <Button variant="ghost" onClick={() => navigate({
              pathname: node?.parent_id && node.parent_id !== ROOT_NODE_ID ? `/files/${node.parent_id}` : "/files",
              search: preservedSearch,
            })}>
              {t("action.goBack")}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => triggerRefresh()}>{t("action.refresh")}</Button>
          {!isTrashRoute ? <Button variant="ghost" onClick={() => navigate({ pathname: "/search", search: preservedSearch })}>{t("field.search")}</Button> : null}
          {actionErrorKey ? <span className="files-page__inline-error">{t(actionErrorKey)}</span> : null}
        </div>
      </header>

      <div className="files-page__actionbar">
        {routeMode === "files" ? (
          <>
            <Button variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("bento:create-folder"))}>{t("action.newFolder")}</Button>
            <Button variant="ghost" onClick={() => window.dispatchEvent(new CustomEvent("bento:upload-files"))}>{t("action.upload")}</Button>
          </>
        ) : null}
        <div className="files-page__actionbar-spacer" />
        <div className="files-page__action-note">
          {selectedNode ? selectedNode.name : pendingUploads.length ? t("msg.filesQuickActionsBody") : t("msg.filesDescription")}
        </div>
      </div>

      <FolderView
        title={title}
        metaLabelKey="field.path"
        metaValue={currentPathLabel}
        items={displayItems}
        nextCursor={isFavoritesRoute ? null : nextCursor}
        loading={loading}
        loadingMore={loadingMore}
        errorKey={errorKey}
        selectedIds={selectedIds}
        ownerLabel={ownerLabel}
        itemPathLabel={itemPathLabel}
        dropTargetId={hoverDropTargetId}
        onToggleSelect={handleToggleSelect}
        onLoadMore={loadMore}
        rowActionRenderer={isTrashRoute ? renderTrashActions : renderFileActions}
        emptyKey={pageEmptyKey}
        onOpenItem={openItem}
        routeMode={routeMode}
        onRetry={() => void runLoad()}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onStartDrag={routeMode === "files" ? handleStartDrag : undefined}
        onDragOverFolder={routeMode === "files" ? handleDragOverFolder : undefined}
        onDragLeaveFolder={routeMode === "files" ? handleDragLeaveFolder : undefined}
        onDropOnFolder={routeMode === "files" ? handleDropOnFolder : undefined}
      />

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

      <Dialog
        open={transferTarget !== null && transferItemIds.length > 0}
        title={transferTarget ? transferTarget.name : t("field.destination")}
        onClose={() => {
          if (!actionId) {
            setTransferTarget(null);
            setTransferItemIds([]);
            setTransferMode(null);
            setTransferErrorKey(null);
          }
        }}
        closeLabel={t("action.close")}
        footer={(
          <div className="nd-dialog__actions">
            <Button
              variant="ghost"
              onClick={() => {
                setTransferTarget(null);
                setTransferItemIds([]);
                setTransferMode(null);
                setTransferErrorKey(null);
              }}
              disabled={!!actionId}
            >
              {t("action.cancel")}
            </Button>
            <Button variant="ghost" onClick={() => void applyTransfer("copy")} loading={actionId !== null && transferMode === "copy"}>
              {t("action.copy")}
            </Button>
            <Button variant="primary" onClick={() => void applyTransfer("move")} loading={actionId !== null && transferMode === "move"}>
              {t("action.move")}
            </Button>
          </div>
        )}
      >
        <p>{t("msg.nSelected").replace("{n}", String(transferItemIds.length))}</p>
        <p>{t("field.destination")}: {transferTarget?.name}</p>
        {transferErrorKey ? <p className="files-page__inline-error">{t(transferErrorKey)}</p> : null}
      </Dialog>
    </section>
  );
}
