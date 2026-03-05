import React from "react";
import { Button } from "../Button";

export type ForbiddenStateProps = {
  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  actionLabelKey?: React.ReactNode;
  onAction?: () => void;

  // Back-compat shims
  title?: React.ReactNode;
  detail?: React.ReactNode;
  message?: React.ReactNode;
};

export function ForbiddenState({
  titleKey,
  descKey,
  actionLabelKey,
  onAction,
  title,
  detail,
  message,
}: ForbiddenStateProps) {
    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--nd-space-12) var(--nd-space-4)",
            textAlign: "center"
        }}>
            <div style={{ fontSize: "40px", marginBottom: "var(--nd-space-4)", filter: "grayscale(100%)" }}>🔐</div>
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
                    color: "var(--nd-color-text-secondary)",
                    fontSize: "var(--nd-font-size-sm)"
                }}>
                    {descKey ?? detail}
                </p>
            )}
            {actionLabelKey && onAction && (
                <Button variant="secondary" onClick={onAction}>
                    {actionLabelKey}
                </Button>
            )}
        </div>
    );
}
