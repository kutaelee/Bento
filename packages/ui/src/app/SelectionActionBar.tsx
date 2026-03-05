import React from "react";
import { Button } from "@nimbus/ui-kit";
import { t } from "../i18n/t";

const barStyles: {
    wrapper: React.CSSProperties;
    content: React.CSSProperties;
    count: React.CSSProperties;
    actions: React.CSSProperties;
} = {
    wrapper: {
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        background: "var(--nd-color-surface-primary)",
        border: "1px solid var(--nd-color-border-default)",
        borderRadius: "var(--nd-radius-full)",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        animation: "slideUp 0.3s ease-out forwards",
    },
    content: {
        display: "flex",
        alignItems: "center",
        gap: 16,
    },
    count: {
        fontSize: 14,
        fontWeight: 600,
        color: "var(--nd-color-text-primary)",
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    actions: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
};

export type SelectionActionBarProps = {
    selectedCount: number;
    onClearSelection: () => void;
    onDownload?: () => void;
    onDelete?: () => void;
    onMove?: () => void;
    onCopy?: () => void;
    onShare?: () => void;
};

export function SelectionActionBar({
    selectedCount,
    onClearSelection,
    onDownload,
    onDelete,
    onMove,
    onCopy,
    onShare,
}: SelectionActionBarProps) {
    if (selectedCount === 0) return null;

    return (
        <>
            <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
            <div style={barStyles.wrapper}>
                <div style={barStyles.content}>
                    <div style={barStyles.count}>
                        <span style={{
                            background: "var(--nd-color-accent-default)",
                            color: "var(--nd-color-surface-primary)",
                            borderRadius: "50%",
                            width: 24,
                            height: 24,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                        }}>
                            {selectedCount}
                        </span>
                        {t("msg.nSelected").replace("{n}", String(selectedCount))}
                    </div>
                    <div style={barStyles.actions}>
                        {onDownload && <Button variant="ghost" onClick={onDownload}>{t("action.download")}</Button>}
                        {onShare && <Button variant="ghost" onClick={onShare}>{t("action.share")}</Button>}
                        {onMove && <Button variant="ghost" onClick={onMove}>{t("action.move")}</Button>}
                        {onCopy && <Button variant="ghost" onClick={onCopy}>{t("action.copy")}</Button>}
                        {onDelete && <Button variant="ghost" onClick={onDelete} style={{ color: "var(--nd-color-status-danger)" }}>{t("action.delete")}</Button>}
                        <div style={{ width: 1, height: 24, background: "var(--nd-color-border-default)", margin: "0 8px" }} />
                        <Button variant="ghost" onClick={onClearSelection}>{t("action.cancel")}</Button>
                    </div>
                </div>
            </div>
        </>
    );
}
