import React from "react";

type ErrorStateProps = {
  title: string;
  detail?: string;
  action?: React.ReactNode;
};

const errorStyles: {
  wrapper: React.CSSProperties;
  title: React.CSSProperties;
  detail: React.CSSProperties;
} = {
  wrapper: {
    border: "1px solid color-mix(in srgb, #dc2626 28%, transparent)",
    borderRadius: "0.75rem",
    padding: "1rem",
    color: "#7f1d1d",
    background: "color-mix(in srgb, #fecaca 28%, transparent)",
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
    color: "#991b1b",
  },
};

export function ErrorState({ title, detail, action }: ErrorStateProps) {
  return (
    <div style={errorStyles.wrapper} role="alert">
      <p style={errorStyles.title}>{title}</p>
      {detail ? <p style={errorStyles.detail}>{detail}</p> : null}
      {action ? <div style={{ marginTop: "0.75rem" }}>{action}</div> : null}
    </div>
  );
}

export type { ErrorStateProps };
