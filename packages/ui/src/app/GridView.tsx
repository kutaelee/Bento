import React from "react";
import { type NodeItem } from "../api/nodes";
import { t } from "../i18n/t";
import { SkeletonBlock } from "@nimbus/ui-kit";

const gridStyles: {
    container: React.CSSProperties;
    card: React.CSSProperties;
    selectedCard: React.CSSProperties;
    icon: React.CSSProperties;
    name: React.CSSProperties;
    meta: React.CSSProperties;
} = {
    container: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 16,
        padding: 16,
    },
    card: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: 16,
        border: "1px solid var(--nd-color-border-default)",
        borderRadius: 12,
        background: "var(--nd-color-surface-current)",
        cursor: "pointer",
        transition: "box-shadow 0.2s, border-color 0.2s",
    },
    selectedCard: {
        borderColor: "var(--nd-color-accent-default)",
        boxShadow: "0 0 0 2px color-mix(in srgb, var(--nd-color-accent-default) 24%, transparent)",
        background: "color-mix(in srgb, var(--nd-color-accent-default) 12%, var(--nd-color-surface-current))",
    },
    icon: {
        width: 48,
        height: 48,
        marginBottom: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--nd-color-surface-tertiary)",
        borderRadius: 8,
        fontSize: 24,
    },
    name: {
        fontSize: 14,
        fontWeight: 500,
        color: "var(--nd-color-text-primary)",
        textAlign: "center",
        wordBreak: "break-all",
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        marginBottom: 4,
    },
    meta: {
        fontSize: 12,
        color: "var(--nd-color-text-secondary)",
        textAlign: "center",
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

export type GridViewProps = {
    items: NodeItem[];
    loading: boolean;
    selectedIds?: Set<string>;
    onToggleSelect?: (item: NodeItem, multi: boolean) => void;
};

export function GridView({ items, loading, selectedIds, onToggleSelect }: GridViewProps) {
    if (loading && items.length === 0) {
        return (
            <div style={gridStyles.container}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={`skel-${i}`} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--nd-color-border-default)", padding: 16, borderRadius: 12 }}>
                        <SkeletonBlock height={48} width={48} style={{ alignSelf: "center", borderRadius: 8 }} />
                        <SkeletonBlock height={16} width="80%" style={{ alignSelf: "center" }} />
                        <SkeletonBlock height={12} width="40%" style={{ alignSelf: "center" }} />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={gridStyles.container}>
            {items.map((item) => {
                const isSelected = selectedIds?.has(item.id) ?? false;
                return (
                    <button
                        type="button"
                        key={item.id}
                        style={{ ...gridStyles.card, ...(isSelected ? gridStyles.selectedCard : null) }}
                        onClick={(event: React.MouseEvent) => onToggleSelect?.(item, event.metaKey || event.ctrlKey || event.shiftKey)}
                    >
                        <div style={gridStyles.icon}>
                            {item.type === "FOLDER" ? "📁" : "📄"}
                        </div>
                        <div style={gridStyles.name} title={item.name}>
                            {item.name}
                        </div>
                        <div style={gridStyles.meta}>
                            {item.type === "FOLDER" ? t("nav.files") : formatSize(item.size_bytes)}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
