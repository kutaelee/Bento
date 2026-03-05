import React from "react";
import { Button } from "../Button";

export type EmptyStateProps = {
  // Primary API (used by app)
  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  actionLabelKey?: React.ReactNode;
  onAction?: () => void;
  icon?: React.ReactNode;

  // Back-compat shims (older pages)
  title?: React.ReactNode;
  detail?: React.ReactNode;
  message?: React.ReactNode;
};

export function EmptyState({
  titleKey,
  descKey,
  actionLabelKey,
  onAction,
  icon,
  title,
  detail,
  message,
}: EmptyStateProps) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--nd-space-12) var(--nd-space-4)",
            textAlign: "center",
            color: "var(--nd-color-text-secondary)"
        }}>
            {icon && <div style={{ fontSize: "40px", marginBottom: "var(--nd-space-4)" }}>{icon}</div>}
            <h3 style={{
                marginTop: 0,
                marginBottom: (descKey ?? detail) ? "var(--nd-space-2)" : "var(--nd-space-4)",
                color: "var(--nd-color-text-primary)",
                fontSize: "var(--nd-font-size-base)"
            }}>
                {titleKey ?? title ?? message}
            </h3>
            {(descKey ?? detail) && (
                <p style={{
                    marginTop: 0,
                    marginBottom: actionLabelKey ? "var(--nd-space-6)" : 0,
                    fontSize: "var(--nd-font-size-sm)"
                }}>
                    {descKey ?? detail}
                </p>
            )}
            {actionLabelKey && onAction && (
                <Button variant="primary" onClick={onAction}>
                    {actionLabelKey}
                </Button>
            )}
        </div>
    );
}
