import React from "react";
import { Button } from "@nimbus/ui-kit";
import { t } from "../i18n/t";

type SelectionActionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onRestore?: () => void;
  onShare?: () => void;
};

const styles = {
  wrapper: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 100,
    background: "color-mix(in srgb, var(--nd-color-surface-primary) 96%, transparent)",
    border: "1px solid var(--nd-color-border-default)",
    borderRadius: 999,
    boxShadow: "var(--nd-shadow-lg)",
    padding: "10px 18px",
    display: "flex",
    alignItems: "center",
    gap: 16,
    maxWidth: "calc(100vw - 32px)",
  } as React.CSSProperties,
  count: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--nd-color-text-primary)",
    display: "flex",
    alignItems: "center",
    gap: 8,
  } as React.CSSProperties,
  badge: {
    background: "var(--nd-color-accent-default)",
    color: "#fff",
    borderRadius: 999,
    minWidth: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    padding: "0 8px",
  } as React.CSSProperties,
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  } as React.CSSProperties,
};

export function SelectionActionBar({
  selectedCount,
  onClearSelection,
  onDownload,
  onDelete,
  onMove,
  onRestore,
  onShare,
}: SelectionActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div style={styles.wrapper}>
      <div style={styles.count}>
        <span style={styles.badge}>{selectedCount}</span>
        {t("msg.nSelected").replace("{n}", String(selectedCount))}
      </div>
      <div style={styles.actions}>
        {onDownload ? <Button variant="ghost" onClick={onDownload}>{t("action.download")}</Button> : null}
        {onShare ? <Button variant="ghost" onClick={onShare}>{t("action.share")}</Button> : null}
        {onMove ? <Button variant="ghost" onClick={onMove}>{t("action.move")}</Button> : null}
        {onRestore ? <Button variant="ghost" onClick={onRestore}>{t("action.restore")}</Button> : null}
        {onDelete ? <Button variant="ghost" onClick={onDelete}>{t("action.delete")}</Button> : null}
        <Button variant="ghost" onClick={onClearSelection}>{t("action.cancel")}</Button>
      </div>
    </div>
  );
}
