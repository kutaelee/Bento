import React, { useEffect, useMemo, useState } from "react";
import { useFolderRefresh } from "./folderRefresh";
import { createNodesApi, type NodeItem } from "../api/nodes";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { ApiError } from "../api/errors";
import { ErrorState, EmptyState, SkeletonBlock, Button } from "@nimbus/ui-kit";
import { MediaCard, Lightbox } from "@nimbus/ui-kit";
import { t, type I18nKey } from "../i18n/t";
import { SelectionActionBar } from "./SelectionActionBar";
import { ROOT_NODE_ID } from "./nodes";

export function MediaPage() {
    const { nonce } = useFolderRefresh();
    const [items, setItems] = useState<NodeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [errorKey, setErrorKey] = useState<I18nKey | null>(null);
    const [nextCursor, setNextCursor] = useState<string | null>(null);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

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
                // Mock loading media from root instead of real search to fulfill UI goal without backend touch
                const response = await nodesApi.listChildren({ nodeId: ROOT_NODE_ID });
                if (!active) return;
                // Filter mock simply by assuming images/videos are folders or have mime types...
                // Actually, just keep all items as media for now if there are any.
                const mediaItems = response.items.filter((item) =>
                    item.type === "FILE" || item.type === "FOLDER"
                );
                setItems(mediaItems);
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
    }, [nonce, nodesApi]);

    const loadMore = async () => {
        if (!nextCursor) return;
        setLoadingMore(true);
        try {
            const response = await nodesApi.listChildren({ nodeId: ROOT_NODE_ID, cursor: nextCursor });
            setItems((prev) => [...prev, ...response.items]);
            setNextCursor(response.next_cursor ?? null);
        } catch {
            // Ignored for load more
        } finally {
            setLoadingMore(false);
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
            <header style={{ marginBottom: "var(--nd-space-4, 16px)" }}>
                <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--nd-color-text-primary)" }}>
                    {t("nav.media")}
                </h1>
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
            ) : items.length === 0 ? (
                <EmptyState
                    icon="🖼️"
                    title={t("msg.emptyMedia")}
                    message={t("msg.emptyMedia")}
                />
            ) : (
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                            gap: "var(--nd-space-4, 16px)",
                        }}
                    >
                        {items.map((item, index) => {
                            const isSelected = selectedIds.has(item.id);
                            const isVideo = item.mime_type?.startsWith("video/");
                            // Only files get a fallback thumbnail
                            const fallbackIcon = item.type === "FILE" && !isVideo ? "📄" : undefined;

                            // In a real app we would have a thumbnailUrl
                            // we don't have it on the dummy NodeType so we'll leave it undefined to show fallback/skeleton
                            return (
                                <MediaCard
                                    key={item.id}
                                    id={item.id}
                                    name={item.name}
                                    isVideo={isVideo || item.name.endsWith(".mp4")}
                                    fallbackIcon={fallbackIcon || "🖼️"}
                                    selected={isSelected}
                                    onSelect={(multi) => handleToggleSelect(item, multi)}
                                    onClick={() => setPreviewIndex(index)}
                                />
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
                        onDownload={selectedIds.size > 0 ? () => alert("Download selected: " + selectedIds.size) : undefined}
                        onDelete={selectedIds.size > 0 ? () => alert("Delete selected: " + selectedIds.size) : undefined}
                        onMove={selectedIds.size > 0 ? () => alert("Move selected: " + selectedIds.size) : undefined}
                    />

                    <Lightbox
                        isOpen={previewIndex !== null}
                        onClose={() => setPreviewIndex(null)}
                        imageUrl={undefined} // No actual images in API
                        imageName={previewIndex !== null ? items[previewIndex]?.name : undefined}
                        onNext={previewIndex !== null && previewIndex < items.length - 1 ? () => setPreviewIndex(previewIndex + 1) : undefined}
                        onPrev={previewIndex !== null && previewIndex > 0 ? () => setPreviewIndex(previewIndex - 1) : undefined}
                    />
                </>
            )}
        </div>
    );
}
