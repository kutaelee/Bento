import React, { useState } from "react";
import { SkeletonBlock } from "../states/SkeletonBlock";

export type MediaCardProps = {
    id: string;
    name: string;
    thumbnailUrl?: string; // If undefined, show skeleton
    fallbackIcon?: string; // e.g., "MIME" or a fallback standard icon
    isVideo?: boolean;
    selected?: boolean;
    onSelect?: (multi: boolean) => void;
    onClick?: () => void;
    style?: React.CSSProperties;
};

export function MediaCard({
    name,
    thumbnailUrl,
    fallbackIcon,
    isVideo,
    selected,
    onSelect,
    onClick,
    style,
}: MediaCardProps) {
    const [imgError, setImgError] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e: React.MouseEvent) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey) {
                    onSelect?.(true);
                } else {
                    onClick?.();
                }
            }}
            onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.();
                }
            }}
            style={{
                position: "relative",
                aspectRatio: "1/1",
                borderRadius: "var(--nd-radius-md, 8px)",
                overflow: "hidden",
                backgroundColor: "var(--nd-color-surface-secondary, #f3f4f6)",
                cursor: "pointer",
                border: selected
                    ? "2px solid var(--nd-color-accent-default, #2563eb)"
                    : "1px solid var(--nd-color-border-subtle, #e5e7eb)",
                boxSizing: "border-box",
                ...style,
            }}
        >
            {!thumbnailUrl && !fallbackIcon && <SkeletonBlock height="100%" width="100%" />}

            {thumbnailUrl && !imgError && (
                <img
                    src={thumbnailUrl}
                    alt={name}
                    onLoad={() => setImgLoaded(true)}
                    onError={() => setImgError(true)}
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: imgLoaded ? 1 : 0,
                        transition: "opacity 0.2s ease-in-out",
                    }}
                />
            )}

            {(imgError || (!thumbnailUrl && fallbackIcon)) && (
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        color: "var(--nd-color-text-secondary, #6b7280)",
                    }}
                >
                    {fallbackIcon || "🚫"}
                </div>
            )}

            {isVideo && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "var(--nd-space-2, 8px)",
                        right: "var(--nd-space-2, 8px)",
                        backgroundColor: "rgba(0,0,0,0.6)",
                        color: "white",
                        padding: "2px 6px",
                        borderRadius: "var(--nd-radius-sm, 4px)",
                        fontSize: "0.75rem",
                    }}
                >
                    ▶
                </div>
            )}
        </div>
    );
}
