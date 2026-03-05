import React from "react";
import { Button } from "../Button";

export type EmptyStateProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;

  // Primary API (used by app)
  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  actionLabelKey?: React.ReactNode;
  onAction?: () => void;

  // Back-compat shims (older pages)
  detail?: React.ReactNode;
  message?: React.ReactNode;
};

export function EmptyState({
  titleKey,
  descKey,
  actionLabelKey,
  onAction,
  icon,
  description,
  action,
  title,
  detail,
  message,
}: EmptyStateProps) {
    const resolvedTitle = title ?? titleKey ?? message;
    const resolvedDescription = description ?? descKey ?? detail;
    const resolvedAction = action ?? (
      actionLabelKey && onAction ? (
        <Button variant="primary" onClick={onAction}>
          {actionLabelKey}
        </Button>
      ) : null
    );

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
                marginBottom: resolvedDescription ? "var(--nd-space-2)" : "var(--nd-space-4)",
                color: "var(--nd-color-text-primary)",
                fontSize: "var(--nd-font-size-base)"
            }}>
                {resolvedTitle}
            </h3>
            {resolvedDescription && (
                <p style={{
                    marginTop: 0,
                    marginBottom: resolvedAction ? "var(--nd-space-6)" : 0,
                    fontSize: "var(--nd-font-size-sm)"
                }}>
                    {resolvedDescription}
                </p>
            )}
            {resolvedAction}
        </div>
    );
}
