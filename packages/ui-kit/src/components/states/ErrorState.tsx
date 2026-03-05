import React from "react";
import { Button } from "../Button";

export type ErrorStateProps = {
  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  retryLabelKey?: React.ReactNode;
  onRetry?: () => void;

  // Back-compat shims
  title?: React.ReactNode;
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
  detail,
  message,
}: ErrorStateProps) {
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
            <div style={{ fontSize: "40px", marginBottom: "var(--nd-space-4)" }}>⚠️</div>
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
                    marginBottom: retryLabelKey ? "var(--nd-space-6)" : 0,
                    color: "var(--nd-color-text-secondary)",
                    fontSize: "var(--nd-font-size-sm)"
                }}>
                    {descKey ?? detail}
                </p>
            )}
            {retryLabelKey && onRetry && (
                <Button variant="outline" onClick={onRetry}>
                    {retryLabelKey}
                </Button>
            )}
        </div>
    );
}
