import React from "react";
import { Button } from "../Button";

export type ForbiddenStateProps = {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;

  titleKey?: React.ReactNode;
  descKey?: React.ReactNode;
  actionLabelKey?: React.ReactNode;
  onAction?: () => void;

  // Back-compat shims
  detail?: React.ReactNode;
  message?: React.ReactNode;
};

export function ForbiddenState({
  titleKey,
  descKey,
  actionLabelKey,
  onAction,
  title,
  description,
  detail,
  message,
  action,
  icon,
}: ForbiddenStateProps) {
    const resolvedTitle = title ?? titleKey ?? message;
    const resolvedDescription = description ?? descKey ?? detail;
    const resolvedAction = action ?? (
      actionLabelKey && onAction ? (
        <Button variant="secondary" onClick={onAction}>
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
            textAlign: "center"
        }}>
            <div style={{ fontSize: "40px", marginBottom: "var(--nd-space-4)", filter: "grayscale(100%)" }}>{icon ?? "🔐"}</div>
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
