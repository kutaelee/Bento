import React from "react";

type PageHeaderProps = {
  title: string;
  metaLabel?: string;
  metaValue?: string | null;
  actions?: React.ReactNode;
  className?: string;
};

const headerStyles: {
  wrapper: React.CSSProperties;
  title: React.CSSProperties;
  meta: React.CSSProperties;
  actions: React.CSSProperties;
} = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: 1.3,
    color: "var(--nd-color-text)",
  },
  meta: {
    margin: 0,
    fontSize: "0.75rem",
    color: "color-mix(in srgb, var(--nd-color-text) 65%, transparent)",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "flex-start",
    flexWrap: "wrap",
    marginTop: "0.25rem",
  },
};

export function PageHeader({ title, metaLabel, metaValue, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={className} style={headerStyles.wrapper}>
      <h1 style={headerStyles.title}>{title}</h1>
      {metaLabel && metaValue ? (
        <p style={headerStyles.meta}>
          {metaLabel}: {metaValue}
        </p>
      ) : null}
      {actions ? <div style={headerStyles.actions}>{actions}</div> : null}
    </header>
  );
}

export type { PageHeaderProps };
