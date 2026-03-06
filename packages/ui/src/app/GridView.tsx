import React from "react";
import { type NodeItem } from "../api/nodes";
import { t } from "../i18n/t";
import { SkeletonBlock } from "@nimbus/ui-kit";
import { formatBytes } from "./format";

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
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16,
    padding: 4,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    border: "1px solid var(--nd-color-border-default)",
    borderRadius: 20,
    background: "linear-gradient(180deg, color-mix(in srgb, var(--nd-color-surface-primary) 96%, #fff 4%), var(--nd-color-surface-primary))",
    cursor: "pointer",
    transition: "box-shadow 0.2s, border-color 0.2s, transform 0.2s",
    textAlign: "left",
  },
  selectedCard: {
    borderColor: "var(--nd-color-accent-default)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--nd-color-accent-default) 18%, transparent)",
    background: "color-mix(in srgb, var(--nd-color-accent-default) 8%, var(--nd-color-surface-primary))",
  },
  icon: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--nd-color-surface-secondary)",
    borderRadius: 14,
    fontSize: 24,
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--nd-color-text-primary)",
    wordBreak: "break-word",
  },
  meta: {
    fontSize: 12,
    color: "var(--nd-color-text-secondary)",
  },
};

export type GridViewProps = {
  items: NodeItem[];
  loading: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (item: NodeItem, multi: boolean) => void;
  onOpenItem?: (item: NodeItem) => void;
};

export function GridView({ items, loading, selectedIds, onToggleSelect, onOpenItem }: GridViewProps) {
  if (loading && items.length === 0) {
    return (
      <div style={gridStyles.container}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={`skel-${i}`} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--nd-color-border-default)", padding: 16, borderRadius: 20 }}>
            <SkeletonBlock height={48} width={48} style={{ borderRadius: 14 }} />
            <SkeletonBlock height={16} width="80%" />
            <SkeletonBlock height={12} width="40%" />
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
            onDoubleClick={() => onOpenItem?.(item)}
          >
            <div style={gridStyles.icon}>{item.type === "FOLDER" ? "¢Ã" : "¢Ç"}</div>
            <div style={gridStyles.name} title={item.name}>
              {item.name}
            </div>
            <div style={gridStyles.meta}>
              {item.type === "FOLDER" ? t("nav.files") : formatBytes(item.size_bytes)}
            </div>
          </button>
        );
      })}
    </div>
  );
}
