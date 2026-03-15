import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Button, Dialog, EmptyState, ErrorState, SkeletonBlock } from "@nimbus/ui-kit";
import { ApiError, mapStatusToErrorKey } from "../api/errors";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { createVolumesApi } from "../api/volumes";
import { t, type I18nKey, getLocale } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { getAccessToken } from "./authTokens";
import { ROOT_NODE_ID } from "./nodes";
import { SelectionActionBar } from "./SelectionActionBar";
import { useFolderRefresh } from "./folderRefresh";
import { useInspectorState } from "./inspectorState";
import { downloadBlob, formatBytes, formatDate } from "./format";
import { getVisualFixtureSearch } from "./visualFixtures";
import { buildDisplayPath } from "./nodePresentation";
import "./MediaPage.css";

type MediaFilter = "all" | "image" | "video";
type MediaKind = "image" | "video";

const MEDIA_SCAN_DEPTH = 4;
const MEDIA_SCAN_LIMIT = 180;
const MEDIA_NODE_LIMIT = 640;
const MEDIA_FOLDER_LIMIT = 80;
const THUMBNAIL_BATCH_SIZE = 48;

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "heic", "heif", "avif"]);
const videoExtensions = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v"]);

function getMediaKind(item: NodeItem): MediaKind | null {
  if (item.type !== "FILE") return null;

  const mimeType = item.mime_type?.toLowerCase() ?? "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";

  const extension = item.name.split(".").pop()?.toLowerCase() ?? "";
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  return null;
}

async function fetchThumbnail(nodeId: string) {
  const token = getAccessToken();
  const response = await fetch(`/media/${nodeId}/thumbnail`, {
    headers: {
      "Accept-Language": getLocale(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 202) {
    return { status: "pending" as const };
  }

  if (!response.ok) {
    throw new ApiError(response.status, mapStatusToErrorKey(response.status));
  }

  return { status: "ready" as const, blob: await response.blob() };
}

async function scanMediaTree(nodesApi: ReturnType<typeof createNodesApi>) {
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: ROOT_NODE_ID as string, depth: 0 }];
  const seenFolders = new Set<string>([ROOT_NODE_ID]);
  const mediaItems: NodeItem[] = [];
  let scannedNodes = 0;
  let truncated = false;

  while (queue.length > 0 && mediaItems.length < MEDIA_SCAN_LIMIT && scannedNodes < MEDIA_NODE_LIMIT) {
    const current = queue.shift();
    if (!current) break;

    let cursor: string | null = null;
    do {
      const response = await nodesApi.listChildren({
        nodeId: current.nodeId,
        cursor,
        limit: 100,
        sort: "updated_at",
        order: "desc",
      });

      for (const item of response.items ?? []) {
        scannedNodes += 1;

        const mediaKind = getMediaKind(item);
        if (mediaKind) {
          mediaItems.push(item);
        }

        if (
          item.type === "FOLDER"
          && current.depth < MEDIA_SCAN_DEPTH
          && seenFolders.size < MEDIA_FOLDER_LIMIT
          && !seenFolders.has(item.id)
        ) {
          seenFolders.add(item.id);
          queue.push({ nodeId: item.id, depth: current.depth + 1 });
        }

        if (mediaItems.length >= MEDIA_SCAN_LIMIT || scannedNodes >= MEDIA_NODE_LIMIT) {
          truncated = true;
          break;
        }
      }

      if (truncated) break;
      cursor = response.next_cursor ?? null;
    } while (cursor);

    if (seenFolders.size >= MEDIA_FOLDER_LIMIT && queue.length > 0) {
      truncated = true;
      break;
    }
  }

  mediaItems.sort((left, right) =>
    left.updated_at > right.updated_at ? -1 : left.updated_at < right.updated_at ? 1 : 0,
  );

  return { mediaItems, truncated };
}

export function MediaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { nodeId: routeNodeId } = useParams();
  const { refreshToken, triggerRefresh } = useFolderRefresh();
  const { setSelectedNode } = useInspectorState();
  const preservedSearch = useMemo(() => getVisualFixtureSearch(location.search), [location.search]);

  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);
  const volumesApi = useMemo(() => createVolumesApi(apiClient), [apiClient]);

  const [items, setItems] = useState<NodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
  const [actionErrorKey, setActionErrorKey] = useState<I18nKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [scanTruncated, setScanTruncated] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewErrorKey, setPreviewErrorKey] = useState<I18nKey | null>(null);
  const [previewPathLabel, setPreviewPathLabel] = useState<string>("-");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [thumbnailPendingIds, setThumbnailPendingIds] = useState<Set<string>>(new Set());
  const [thumbnailFailedIds, setThumbnailFailedIds] = useState<Set<string>>(new Set());
  const thumbnailUrlsRef = useRef<Record<string, string>>({});
  const [thumbnailRetryTick, setThumbnailRetryTick] = useState(0);
  const [activeBasePath, setActiveBasePath] = useState("/");

  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => filter === "all" || getMediaKind(item) === filter),
    [filter, items],
  );

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds],
  );

  const previewItem = previewId ? itemsById[previewId] ?? null : null;
  const previewIndex = previewItem ? filteredItems.findIndex((item) => item.id === previewItem.id) : -1;
  const imageCount = items.filter((item) => getMediaKind(item) === "image").length;
  const videoCount = items.filter((item) => getMediaKind(item) === "video").length;

  useEffect(() => {
    thumbnailUrlsRef.current = thumbnailUrls;
  }, [thumbnailUrls]);

  useEffect(() => () => {
    Object.values(thumbnailUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

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
    if (thumbnailPendingIds.size === 0) return undefined;
    const timeout = window.setTimeout(() => {
      setThumbnailPendingIds(new Set());
      setThumbnailRetryTick((prev) => prev + 1);
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [thumbnailPendingIds]);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setErrorKey(null);
    setActionErrorKey(null);
    setPreviewId(null);
    setSelectedIds(new Set());
    setSelectedNode(null);
    Object.values(thumbnailUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    thumbnailUrlsRef.current = {};
    setThumbnailUrls({});
    setThumbnailPendingIds(new Set());
    setThumbnailFailedIds(new Set());

    void (async () => {
      try {
        const { mediaItems, truncated } = await scanMediaTree(nodesApi);
        if (!active) return;
        setItems(mediaItems);
        setScanTruncated(truncated);
      } catch (error) {
        if (!active) return;
        setItems([]);
        setScanTruncated(false);
        setErrorKey(error instanceof ApiError ? error.key : "err.network");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [nodesApi, refreshToken, setSelectedNode]);

  useEffect(() => {
    const nextSelection = Array.from(selectedIds);
    if (nextSelection.length !== 1) {
      setSelectedNode(null);
      return;
    }

    setSelectedNode(itemsById[nextSelection[0]] ?? null);
  }, [itemsById, selectedIds, setSelectedNode]);

  useEffect(() => {
    if (!routeNodeId) {
      setPreviewId(null);
      return;
    }

    if (loading) return;

    const routeItem = itemsById[routeNodeId];
    if (!routeItem) {
      navigate("/media", { replace: true });
      return;
    }

    setSelectedIds(new Set([routeNodeId]));
    setPreviewId(routeNodeId);
  }, [itemsById, loading, navigate, routeNodeId]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const targets = items.slice(0, THUMBNAIL_BATCH_SIZE).filter((item) => {
        const kind = getMediaKind(item);
        return kind !== null
          && !thumbnailUrls[item.id]
          && !thumbnailPendingIds.has(item.id)
          && !thumbnailFailedIds.has(item.id);
      });

      for (const item of targets) {
        if (!active) break;
        try {
          const result = await fetchThumbnail(item.id);
          if (!active) break;

          if (result.status === "pending") {
            setThumbnailPendingIds((prev) => new Set(prev).add(item.id));
            continue;
          }

          const objectUrl = URL.createObjectURL(result.blob);
          setThumbnailUrls((prev) => {
            const next = { ...prev, [item.id]: objectUrl };
            return next;
          });
        } catch {
          if (!active) break;
          setThumbnailFailedIds((prev) => new Set(prev).add(item.id));
        }
      }
    };

    if (items.length > 0) {
      void run();
    }

    return () => {
      active = false;
    };
  }, [items, thumbnailFailedIds, thumbnailPendingIds, thumbnailRetryTick, thumbnailUrls]);

  useEffect(() => {
    if (!previewItem) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewErrorKey(null);
      return;
    }

    const controller = new AbortController();
    let objectUrl: string | null = null;
    let active = true;

    setPreviewLoading(true);
    setPreviewErrorKey(null);
    setPreviewUrl(null);

    void (async () => {
      try {
        const blob = await nodesApi.downloadNode({ nodeId: previewItem.id, signal: controller.signal });
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch (error) {
        if (!active) return;
        setPreviewErrorKey(error instanceof ApiError ? error.key : "err.network");
      } finally {
        if (active) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [nodesApi, previewItem]);

  useEffect(() => {
    let active = true;

    if (!previewItem) {
      setPreviewPathLabel("-");
      return () => {
        active = false;
      };
    }

    void (async () => {
      try {
        const response = await nodesApi.getBreadcrumb(previewItem.id);
        if (!active) return;
        setPreviewPathLabel(buildDisplayPath(activeBasePath, response.items ?? []));
      } catch {
        if (!active) return;
        setPreviewPathLabel(previewItem.path);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeBasePath, nodesApi, previewItem]);

  const handleRefresh = useCallback(() => {
    triggerRefresh();
  }, [triggerRefresh]);

  const handleToggleSelect = useCallback((item: NodeItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleOpenPreview = useCallback((item: NodeItem) => {
    setSelectedIds(new Set([item.id]));
    setPreviewId(item.id);
    navigate({ pathname: `/media/${item.id}`, search: preservedSearch });
  }, [navigate, preservedSearch]);

  const handleDownloadSelected = useCallback(async () => {
    setActionBusy(true);
    setActionErrorKey(null);
    try {
      for (const item of selectedItems) {
        const blob = await nodesApi.downloadNode({ nodeId: item.id });
        await downloadBlob(blob, item.name);
      }
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionBusy(false);
    }
  }, [nodesApi, selectedItems]);

  const handleDeleteSelected = useCallback(async () => {
    setActionBusy(true);
    setActionErrorKey(null);
    try {
      for (const item of selectedItems) {
        await nodesApi.deleteNode({ nodeId: item.id });
      }

      setThumbnailUrls((prev) => {
        const next = { ...prev };
        selectedItems.forEach((item) => {
          const url = next[item.id];
          if (url) {
            URL.revokeObjectURL(url);
            delete next[item.id];
          }
        });
        thumbnailUrlsRef.current = next;
        return next;
      });
      setThumbnailPendingIds((prev) => {
        const next = new Set(prev);
        selectedItems.forEach((item) => next.delete(item.id));
        return next;
      });
      setThumbnailFailedIds((prev) => {
        const next = new Set(prev);
        selectedItems.forEach((item) => next.delete(item.id));
        return next;
      });

      setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setPreviewId(null);
      if (routeNodeId) {
        navigate({ pathname: "/media", search: preservedSearch }, { replace: true });
      }
      setIsDeleteDialogOpen(false);
      triggerRefresh();
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionBusy(false);
    }
  }, [navigate, nodesApi, preservedSearch, routeNodeId, selectedIds, selectedItems, triggerRefresh]);

  const handleDownloadPreview = useCallback(async () => {
    if (!previewItem) return;

    setActionBusy(true);
    setActionErrorKey(null);
    try {
      const blob = await nodesApi.downloadNode({ nodeId: previewItem.id });
      await downloadBlob(blob, previewItem.name);
    } catch (error) {
      setActionErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActionBusy(false);
    }
  }, [nodesApi, previewItem]);

  const previewKind = previewItem ? getMediaKind(previewItem) : null;

  const summaryCards = [
    { label: t("msg.mediaSummaryTotal"), value: String(items.length) },
    { label: t("msg.mediaSummaryImages"), value: String(imageCount) },
    { label: t("msg.mediaSummaryVideos"), value: String(videoCount) },
    { label: t("msg.mediaSummarySelected"), value: String(selectedIds.size) },
  ];

  if (errorKey) {
    return (
      <section className="media-page">
        <ErrorState
          titleKey={t("err.unknown")}
          descKey={t(errorKey)}
          retryLabelKey={t("action.retry")}
          onRetry={handleRefresh}
        />
      </section>
    );
  }

  return (
    <section className="media-page">
      <header className="media-page__hero">
        <div className="media-page__hero-copy">
          <p className="media-page__eyebrow">{t("nav.media")}</p>
          <h1 className="media-page__title">{t("nav.media")}</h1>
          <p className="media-page__description">{t("msg.mediaDescription")}</p>
        </div>
        <div className="media-page__hero-actions">
          <Button variant="ghost" onClick={() => navigate({ pathname: "/search", search: preservedSearch })}>{t("field.search")}</Button>
          <Button variant="primary" onClick={handleRefresh}>{t("action.refresh")}</Button>
        </div>
      </header>

      <section className="media-page__summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className="media-page__summary-card">
            <span className="media-page__summary-label">{card.label}</span>
            <strong className="media-page__summary-value">{card.value}</strong>
          </article>
        ))}
      </section>

      <section className="media-page__toolbar">
        <div className="media-page__filters">
          {(["all", "image", "video"] as MediaFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? "media-page__filter media-page__filter--active" : "media-page__filter"}
              onClick={() => setFilter(value)}
            >
              {value !== "all" ? (
                <span className="material-symbols-outlined" aria-hidden="true">
                  {value === "image" ? "image" : "movie"}
                </span>
              ) : null}
              {value === "all"
                ? t("msg.mediaFilterAll")
                : value === "image"
                  ? t("msg.mediaFilterImages")
                  : t("msg.mediaFilterVideos")}
            </button>
          ))}
        </div>
        {scanTruncated ? <div className="media-page__scan-note">{t("msg.mediaScanPartial")}</div> : null}
      </section>

      {actionErrorKey ? <div className="media-page__banner media-page__banner--error">{t(actionErrorKey)}</div> : null}

      {loading ? (
        <section className="media-page__grid">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={`media-skeleton-${index}`} className="media-page__card media-page__card--loading">
              <SkeletonBlock height="100%" width="100%" />
            </div>
          ))}
        </section>
      ) : filteredItems.length === 0 ? (
        <EmptyState titleKey={t("msg.emptyMedia")} descKey={t("msg.mediaSelectionEmpty")} />
      ) : (
        <section className="media-page__grid">
          {filteredItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const kind = getMediaKind(item);
            const thumbnailUrl = thumbnailUrls[item.id];
            const isPending = thumbnailPendingIds.has(item.id);

            return (
              <article
                key={item.id}
                className={isSelected ? "media-page__card media-page__card--selected" : "media-page__card"}
              >
                <button
                  type="button"
                  className={isSelected ? "media-page__select media-page__select--active" : "media-page__select"}
                  onClick={() => handleToggleSelect(item)}
                  aria-pressed={isSelected}
                >
                  {isSelected ? t("action.selected") : t("action.select")}
                </button>
                <button type="button" className="media-page__card-button" onClick={() => handleOpenPreview(item)}>
                  <div className="media-page__thumb">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={item.name}
                        className="media-page__thumb-image"
                        onError={() => {
                          setThumbnailUrls((prev) => {
                            const next = { ...prev };
                            const url = next[item.id];
                            if (url) {
                              URL.revokeObjectURL(url);
                              delete next[item.id];
                            }
                            thumbnailUrlsRef.current = next;
                            return next;
                          });
                          setThumbnailFailedIds((prev) => new Set(prev).add(item.id));
                        }}
                      />
                    ) : null}
                    {!thumbnailUrl ? (
                      <div className="media-page__thumb-fallback">
                        <strong>{kind === "video" ? "VIDEO" : "IMAGE"}</strong>
                        <span>{isPending ? t("msg.mediaPendingThumbnail") : item.name.slice(0, 1).toUpperCase()}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="media-page__card-overlay" />
                  <div className="media-page__card-meta">
                    <strong>{item.name}</strong>
                    <span>{`${formatDate(item.updated_at)} / ${formatBytes(item.size_bytes)}`}</span>
                  </div>
                  <span className="media-page__card-kind">{kind === "video" ? t("msg.mediaFilterVideos") : t("msg.mediaFilterImages")}</span>
                </button>
              </article>
            );
          })}
        </section>
      )}

      <SelectionActionBar
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        onDownload={selectedItems.length > 0 ? () => void handleDownloadSelected() : undefined}
        onDelete={selectedItems.length > 0 ? () => setIsDeleteDialogOpen(true) : undefined}
      />

      {previewItem ? (
        <div className="media-page__preview" role="dialog" aria-modal="true" aria-label={previewItem.name}>
          <button
            type="button"
            className="media-page__preview-close"
            onClick={() => {
              setPreviewId(null);
              navigate({ pathname: "/media", search: preservedSearch });
            }}
          >
            {t("action.close")}
          </button>
          {previewIndex > 0 ? (
            <button
              type="button"
              className="media-page__preview-nav media-page__preview-nav--prev"
              onClick={() => {
                const previousItem = filteredItems[previewIndex - 1];
                if (previousItem) {
                  setPreviewId(previousItem.id);
                  navigate({ pathname: `/media/${previousItem.id}`, search: preservedSearch });
                }
              }}
            >
              {t("action.previous")}
            </button>
          ) : null}
          {previewIndex >= 0 && previewIndex < filteredItems.length - 1 ? (
            <button
              type="button"
              className="media-page__preview-nav media-page__preview-nav--next"
              onClick={() => {
                const nextItem = filteredItems[previewIndex + 1];
                if (nextItem) {
                  setPreviewId(nextItem.id);
                  navigate({ pathname: `/media/${nextItem.id}`, search: preservedSearch });
                }
              }}
            >
              {t("action.next")}
            </button>
          ) : null}
          <div className="media-page__preview-frame">
            {previewLoading ? <div className="media-page__preview-message">{t("msg.mediaPreviewLoading")}</div> : null}
            {!previewLoading && previewErrorKey ? <div className="media-page__preview-message">{t(previewErrorKey)}</div> : null}
            {!previewLoading && previewErrorKey ? (
              <div className="media-page__preview-actions">
                <Button variant="ghost" onClick={() => void handleDownloadPreview()} disabled={actionBusy}>
                  {t("action.download")}
                </Button>
              </div>
            ) : null}
            {!previewLoading && !previewErrorKey && previewUrl && previewKind === "video" ? (
              <video
                className="media-page__preview-media"
                src={previewUrl}
                controls
                autoPlay
                onError={() => setPreviewErrorKey("msg.mediaPreviewUnavailable")}
              />
            ) : null}
            {!previewLoading && !previewErrorKey && previewUrl && previewKind === "image" ? (
              <img
                className="media-page__preview-media"
                src={previewUrl}
                alt={previewItem.name}
                onError={() => setPreviewErrorKey("msg.mediaPreviewUnavailable")}
              />
            ) : null}
            {!previewLoading && !previewErrorKey && !previewUrl ? (
              <div className="media-page__preview-message">{t("msg.mediaPreviewUnavailable")}</div>
            ) : null}
          </div>
              <div className="media-page__preview-meta">
                <div>
                  <h2 className="media-page__preview-title">{previewItem.name}</h2>
                  <p className="media-page__preview-copy">{previewPathLabel}</p>
                </div>
            <div className="media-page__preview-stats">
              <span>{formatDate(previewItem.updated_at)}</span>
              <span>{formatBytes(previewItem.size_bytes)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={isDeleteDialogOpen}
        title={t("modal.delete.title")}
        onClose={() => {
          if (!actionBusy) {
            setIsDeleteDialogOpen(false);
          }
        }}
        closeLabel={t("action.close")}
        footer={(
          <div className="nd-dialog__actions">
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={actionBusy}>
              {t("action.cancel")}
            </Button>
            <Button variant="primary" onClick={() => void handleDeleteSelected()} loading={actionBusy}>
              {t("action.delete")}
            </Button>
          </div>
        )}
      >
        <p>{t("modal.delete.desc")}</p>
      </Dialog>
    </section>
  );
}
