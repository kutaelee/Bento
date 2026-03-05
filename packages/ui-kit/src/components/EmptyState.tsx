import React from "react";

type EmptyStateProps = {
  title: string;
  detail?: string;
  action?: React.ReactNode;
};

const emptyStyles: {
  wrapper: React.CSSProperties;
  title: React.CSSProperties;
  detail: React.CSSProperties;
} = {
  wrapper: {
    border: "1px dashed color-mix(in srgb, var(--nd-color-primary) 35%, transparent)",
    borderRadius: "0.75rem",
    padding: "1.25rem",
    color: "color-mix(in srgb, var(--nd-color-text) 80%, transparent)",
    background: "color-mix(in srgb, var(--nd-color-surface-current) 94%, #000 6%)",
  },
  title: {
    margin: 0,
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  detail: {
    marginTop: "0.5rem",
    marginBottom: 0,
    fontSize: "0.85rem",
    color: "color-mix(in srgb, var(--nd-color-text) 70%, transparent)",
  },
};

export function EmptyState({ title, detail, action }: EmptyStateProps) {
  return (
    <div style={emptyStyles.wrapper} role="status">
      <p style={emptyStyles.title}>{title}</p>
      {detail ? <p style={emptyStyles.detail}>{detail}</p> : null}
      {action ? <div style={{ marginTop: "0.75rem" }}>{action}</div> : null}
    </div>
  );
}

export type { EmptyStateProps };
