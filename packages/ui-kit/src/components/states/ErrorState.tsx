import React from "react";
import { Button } from "../Button";

export type ErrorStateProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;

  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  retryLabelKey?: React.ReactNode;
  onRetry?: () => void;

  // Back-compat shims
  detail?: React.ReactNode;
  message?: React.ReactNode;
  actionVariant?: string;
  onAction?: () => void;
};

export function ErrorState({
  titleKey,
  descKey,
  retryLabelKey,
  onRetry,
  title,
  description,
  detail,
  message,
  action,
  icon,
}: ErrorStateProps) {
    const resolvedTitle = title ?? titleKey ?? message;
    const resolvedDescription = description ?? descKey ?? detail;
    const resolvedAction = action ?? (
      retryLabelKey && onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {retryLabelKey}
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
            color: "var(--nd-color-status-danger)"
        }}>
            <div style={{ fontSize: "40px", marginBottom: "var(--nd-space-4)" }}>{icon ?? "⚠️"}</div>
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
                    color: "var(--nd-color-text-secondary)",
                    fontSize: "var(--nd-font-size-sm)"
                }}>
                    {resolvedDescription}
                </p>
            )}
            {resolvedAction}
        </div>
    );
}
