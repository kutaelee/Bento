import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useFolderRefresh } from "./folderRefresh";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { ApiError } from "../api/errors";
import { ErrorState, EmptyState, SkeletonBlock, Button } from "@nimbus/ui-kit";
import { MediaCard, Lightbox } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { SelectionActionBar } from "./SelectionActionBar";
import { ROOT_NODE_ID } from "./nodes";
import { getAccessToken } from "./authTokens";

export function MediaPage() {
    const { nonce } = useFolderRefresh();
    const navigate = useNavigate();
    const { nodeId } = useParams();
    const currentNodeId = nodeId ?? ROOT_NODE_ID;
    const [items, setItems] = useState<NodeItem[]>([]);
    const [folders, setFolders] = useState<NodeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
    const [previewIsVideo, setPreviewIsVideo] = useState(false);
    const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([]);

    const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
    const nodesApi = useMemo(() => createNodesApi(apiClient), [apiClient]);

    // Actually, there is currently no specific API endpoint for listing 'all media' in the nodeApi.
    // We'll mimic this by listing files from a simulated 'media' query, or just fetching Root and filtering.
    // Wait, let's just make an API call to listChildren(ROOT) and filter locally for demonstration, 
    // since this is purely a frontend UX task and changing backend is Out of Scope.
    useEffect(() => {
        let active = true;

        setSelectedIds(new Set());
        setPreviewIndex(null);

        const load = async () => {
            setLoading(true);
            setErrorKey(null);
            try {
                const response = await nodesApi.listChildren({ nodeId: currentNodeId });
                if (!active) return;
                const nextItems = response.items ?? [];
                const crumbRes = await nodesApi.getBreadcrumb(currentNodeId);
                const mediaItems = nextItems.filter((item) => {
                    if (item.type !== "FILE") return false;
                    const mime = item.mime_type?.toLowerCase() ?? "";
                    const name = item.name.toLowerCase();
                    return mime.startsWith("image/") || mime.startsWith("video/") || /\.(jpg|jpeg|png|gif|webp|bmp|heic|mp4|mov|mkv|webm)$/i.test(name);
                });
                setFolders(nextItems.filter((item) => item.type === "FOLDER"));
                setItems(mediaItems);
                setBreadcrumbs((crumbRes.items ?? []).map((c) => ({ id: c.id, name: c.name })));
                setNextCursor(response.next_cursor ?? null);
            } catch (error) {
                if (!active) return;
                if (error instanceof ApiError) {
                    setErrorKey(error.key);
                } else {
                    setErrorKey("err.network");
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        load();

        return () => {
            active = false;
        };
    }, [currentNodeId, nonce, nodesApi]);

    const loadMore = async () => {
        if (!nextCursor) return;
        setLoadingMore(true);
        try {
            const response = await nodesApi.listChildren({ nodeId: currentNodeId, cursor: nextCursor });
            const moreMedia = response.items.filter((item) => {
                if (item.type !== "FILE") return false;
                const mime = item.mime_type?.toLowerCase() ?? "";
                const name = item.name.toLowerCase();
                return mime.startsWith("image/") || mime.startsWith("video/") || /\.(jpg|jpeg|png|gif|webp|bmp|heic|mp4|mov|mkv|webm)$/i.test(name);
            });
            setItems((prev) => [...prev, ...moreMedia]);
            setNextCursor(response.next_cursor ?? null);
        } catch {
            // Ignored for load more
        } finally {
            setLoadingMore(false);
        }
    };

    const handleOpenPreview = async (item: NodeItem, index: number) => {
        if (item.type !== "FILE") return;
        try {
            const isVideo = item.mime_type?.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(item.name.toLowerCase());
            if (isVideo) {
                const token = getAccessToken();
                const qp = token ? `?access_token=${encodeURIComponent(token)}` : "";
                setPreviewUrl(`/nodes/${item.id}/download${qp}`);
                setPreviewIsVideo(true);
                setPreviewIndex(index);
                return;
            }

            const blob = await nodesApi.downloadNode({ nodeId: item.id });
            const objectUrl = URL.createObjectURL(blob);
            setPreviewUrl((prev) => {
                if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                return objectUrl;
            });
            setPreviewIsVideo(false);
            setPreviewIndex(index);
        } catch {
            setPreviewIndex(null);
        }
    };

    const handleToggleSelect = (item: NodeItem, multi: boolean) => {
        setSelectedIds((prev: Set<string>) => {
            const next = new Set(multi ? prev : []);
            if (multi && prev.has(item.id)) {
                next.delete(item.id);
            } else {
                next.add(item.id);
            }
            return next;
        });
    };

    if (errorKey) {
        return (
            <div style={{ padding: "var(--nd-space-6, 24px)" }}>
                <ErrorState
                    message={t(errorKey)}
                    actionVariant="secondary"
                    onAction={() => window.location.reload()}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: "var(--nd-space-4, 16px)", height: "100%", overflowY: "auto" }}>
            <header style={{ marginBottom: "var(--nd-space-4, 16px)", display: "grid", gap: 8 }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--nd-color-text-primary)" }}>
                    {t("nav.media")}
                </h1>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Button variant="ghost" onClick={() => navigate("/media")}>루트</Button>
                    {breadcrumbs.length > 1 ? (
                        <Button
                            variant="ghost"
                            onClick={() => navigate(`/media/${breadcrumbs[breadcrumbs.length - 2].id}`)}
                        >
                            상위 폴더
                        </Button>
                    ) : null}
                    {breadcrumbs.slice(1).map((crumb) => (
                        <Button key={crumb.id} variant="ghost" onClick={() => navigate(`/media/${crumb.id}`)}>
                            {crumb.name}
                        </Button>
                    ))}
                </div>
            </header>

            {loading && items.length === 0 ? (
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                        gap: "var(--nd-space-4, 16px)",
                    }}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={`skel-${i}`} style={{ aspectRatio: "1/1" }}>
                            <SkeletonBlock height="100%" width="100%" style={{ borderRadius: "var(--nd-radius-md, 8px)" }} />
                        </div>
                    ))}
                </div>
            ) : items.length === 0 && folders.length === 0 ? (
                <EmptyState
                    icon="🖼️"
                    title={t("msg.emptyMedia")}
                    message={t("msg.emptyMedia")}
                />
            ) : (
                <>
                    {folders.length > 0 ? (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 13, color: "var(--nd-color-text-secondary)", marginBottom: 8 }}>{t("msg.folderType")}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {folders.map((folder) => (
                                    <Button key={folder.id} variant="ghost" onClick={() => navigate(`/media/${folder.id}`)}>
                                        📁 {folder.name}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "var(--nd-space-4, 16px)",
                        }}
                    >
                        {items.map((item, index) => {
                            const shouldLoadThumb = index < 24;
                            const token = getAccessToken();
                            const tokenQuery = token ? `?access_token=${encodeURIComponent(token)}` : "";
                            const isSelected = selectedIds.has(item.id);
                            const nameLower = item.name.toLowerCase();
                            const isVideo = item.mime_type?.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(nameLower);
                            const isImage = item.mime_type?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i.test(nameLower);
                            const fallbackIcon = item.type === "FILE"
                                ? (isImage ? "🖼️" : isVideo ? "🎬" : "📄")
                                : "📁";

                            // In a real app we would have a thumbnailUrl
                            // we don't have it on the dummy NodeType so we'll leave it undefined to show fallback/skeleton
                            return (
                                <div key={item.id} style={{ display: "grid", gap: 6 }}>
                                    <MediaCard
                                        id={item.id}
                                        name={item.name}
                                        thumbnailUrl={shouldLoadThumb
                                            ? (isImage
                                                ? `/nodes/${item.id}/download${tokenQuery}`
                                                : isVideo
                                                    ? `/media/${item.id}/thumbnail`
                                                    : undefined)
                                            : undefined}
                                        isVideo={isVideo || item.name.endsWith(".mp4")}
                                        fallbackIcon={
                                            item.mime_type?.startsWith("image/")
                                                ? "🖼️"
                                                : (isVideo || item.name.endsWith(".mp4"))
                                                    ? "🎬"
                                                    : (fallbackIcon || "📄")
                                        }
                                        selected={isSelected}
                                        onSelect={(multi) => handleToggleSelect(item, multi)}
                                        onClick={() => void handleOpenPreview(item, index)}
                                    />
                                    <div style={{ fontSize: 12, color: "var(--nd-color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>
                                        {item.name}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {nextCursor && (
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--nd-space-6, 24px)" }}>
                            <Button onClick={loadMore} loading={loadingMore} variant="secondary">
                                {t("action.loadMore")}
                            </Button>
                        </div>
                    )}

                    <SelectionActionBar
                        selectedCount={selectedIds.size}
                        onClearSelection={() => setSelectedIds(new Set())}
                        onDownload={selectedIds.size > 0 ? () => alert(t("msg.mediaDownloadSelected").replace("{n}", String(selectedIds.size))) : undefined}
                        onDelete={selectedIds.size > 0 ? () => alert(t("msg.mediaDeleteSelected").replace("{n}", String(selectedIds.size))) : undefined}
                        onMove={selectedIds.size > 0 ? () => alert(t("msg.mediaMoveSelected").replace("{n}", String(selectedIds.size))) : undefined}
                    />

                    {previewIsVideo ? (
                        previewIndex !== null && previewUrl ? (
                            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "grid", placeItems: "center", padding: 16 }}>
                                <div style={{ width: "min(960px, 96vw)", background: "#111", borderRadius: 12, overflow: "hidden" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", color: "#fff" }}>
                                        <strong style={{ fontSize: 14 }}>{items[previewIndex]?.name}</strong>
                                        <Button variant="secondary" onClick={() => {
                                            setPreviewIndex(null);
                                            setPreviewIsVideo(false);
                                            setPreviewUrl((prev) => {
                                                if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                                                return undefined;
                                            });
                                        }}>닫기</Button>
                                    </div>
                                    <video src={previewUrl} controls autoPlay style={{ width: "100%", maxHeight: "80vh", background: "#000" }} />
                                </div>
                            </div>
                        ) : null
                    ) : (
                        <Lightbox
                            isOpen={previewIndex !== null}
                            onClose={() => {
                                setPreviewIndex(null);
                                setPreviewIsVideo(false);
                                setPreviewUrl((prev) => {
                                    if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                                    return undefined;
                                });
                            }}
                            imageUrl={previewUrl}
                            imageName={previewIndex !== null ? items[previewIndex]?.name : undefined}
                            onNext={previewIndex !== null && previewIndex < items.length - 1 ? () => void handleOpenPreview(items[previewIndex + 1], previewIndex + 1) : undefined}
                            onPrev={previewIndex !== null && previewIndex > 0 ? () => void handleOpenPreview(items[previewIndex - 1], previewIndex - 1) : undefined}
                        />
                    )}
                </>
            )}
        </div>
    );
}
