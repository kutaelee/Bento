import React from "react";
import { Button } from "@nimbus/ui-kit";
import { t } from "../i18n/t";
import "./SelectionActionBar.css";

type SelectionActionBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  onRestore?: () => void;
  onShare?: () => void;
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
    <div className="selection-action-bar">
      <div className="selection-action-bar__count">
        <span className="selection-action-bar__badge">{selectedCount}</span>
        {t("msg.nSelected").replace("{n}", String(selectedCount))}
      </div>
      <div className="selection-action-bar__actions">
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
