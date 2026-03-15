import React from "react";
import { type NodeItem } from "../api/nodes";
import { t } from "../i18n/t";
import { SkeletonBlock } from "@nimbus/ui-kit";
import { formatBytes } from "./format";
import { FileTypeIcon } from "./FileTypeIcon";
import { FavoriteIcon } from "./FavoriteIcon";

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
    border: "1px solid var(--bento-shell-border)",
    borderRadius: 20,
    background: "linear-gradient(180deg, color-mix(in srgb, var(--bento-shell-panel) 96%, white 4%), var(--bento-shell-panel-strong))",
    cursor: "pointer",
    transition: "box-shadow 0.2s, border-color 0.2s, transform 0.2s",
    textAlign: "left",
    boxShadow: "var(--bento-shell-shadow-card)",
  },
  selectedCard: {
    borderColor: "var(--bento-shell-accent)",
    boxShadow: "0 0 0 2px color-mix(in srgb, var(--bento-shell-accent) 18%, transparent)",
    background: "color-mix(in srgb, var(--bento-shell-accent) 8%, var(--bento-shell-panel-strong))",
  },
  icon: {
    width: 48,
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--bento-shell-text)",
    wordBreak: "break-word",
  },
  meta: {
    fontSize: 12,
    color: "var(--bento-shell-muted)",
  },
};

export type GridViewProps = {
  items: NodeItem[];
  loading: boolean;
  selectedIds?: Set<string>;
  favoriteIds?: Set<string>;
  dropTargetId?: string | null;
  onToggleSelect?: (item: NodeItem, modifiers: { multi: boolean; range: boolean }) => void;
  onOpenItem?: (item: NodeItem) => void;
  onToggleFavorite?: (item: NodeItem) => void;
  onStartDrag?: (item: NodeItem, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragOverFolder?: (item: NodeItem, event: React.DragEvent<HTMLButtonElement>) => void;
  onDragLeaveFolder?: (item: NodeItem) => void;
  onDropOnFolder?: (item: NodeItem, event: React.DragEvent<HTMLButtonElement>) => void;
};

export function GridView({
  items,
  loading,
  selectedIds,
  favoriteIds,
  dropTargetId,
  onToggleSelect,
  onOpenItem,
  onToggleFavorite,
  onStartDrag,
  onDragOverFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: GridViewProps) {
  if (loading && items.length === 0) {
    return (
      <div style={gridStyles.container}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={`skel-${i}`} style={{ display: "flex", flexDirection: "column", gap: 12, border: "1px solid var(--bento-shell-border)", padding: 16, borderRadius: 20 }}>
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
        const isFavorite = favoriteIds?.has(item.id) ?? false;
        const isDropTarget = dropTargetId === item.id;
        const isDroppableFolder = item.type === "FOLDER" && Boolean(onDropOnFolder);
        return (
          <button
            type="button"
            key={item.id}
            draggable={Boolean(onStartDrag)}
            style={{
              ...gridStyles.card,
              ...(isSelected ? gridStyles.selectedCard : null),
              ...(isDropTarget
                ? {
                    borderColor: "var(--bento-shell-success)",
                    boxShadow: "0 0 0 2px color-mix(in srgb, var(--bento-shell-success) 28%, transparent)",
                  }
                : null),
            }}
            onClick={(event: React.MouseEvent) => onToggleSelect?.(item, {
              multi: event.metaKey || event.ctrlKey || event.shiftKey,
              range: event.shiftKey,
            })}
            onDoubleClick={() => onOpenItem?.(item)}
            onDragStart={(event) => onStartDrag?.(item, event)}
            onDragOver={(event) => {
              if (!isDroppableFolder) return;
              onDragOverFolder?.(item, event);
            }}
            onDragLeave={() => {
              if (!isDroppableFolder) return;
              onDragLeaveFolder?.(item);
            }}
            onDrop={(event) => {
              if (!isDroppableFolder) return;
              onDropOnFolder?.(item, event);
            }}
          >
            {onToggleFavorite ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={isFavorite ? t("action.removeFavorite") : t("action.favorite")}
                style={{
                  alignSelf: "flex-end",
                  marginBottom: -6,
                  color: isFavorite ? "var(--bento-shell-warning)" : "var(--bento-shell-muted)",
                }}
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
                <FavoriteIcon active={isFavorite} />
              </span>
            ) : null}
            <div style={gridStyles.icon}>
              <FileTypeIcon item={item} />
            </div>
            <div style={gridStyles.name} title={item.name}>
              {item.name}
            </div>
            <div style={gridStyles.meta}>
              {item.type === "FOLDER" ? t("nav.files") : formatBytes(item.size_bytes)}
            </div>
            {isDropTarget ? (
              <div style={{ ...gridStyles.meta, color: "var(--bento-shell-success)", fontWeight: 700 }}>
                {t("field.destination")}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
