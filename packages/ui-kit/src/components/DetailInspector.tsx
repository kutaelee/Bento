import React from "react";

type DetailInspectorProps = {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const styles: {
  wrapper: React.CSSProperties;
  title: React.CSSProperties;
} = {
  wrapper: {
    height: "100%",
    background: "var(--nd-color-surface-current, #f3f4f6)",
    borderLeft: "1px solid color-mix(in srgb, #000 10%, transparent)",
  },
  title: {
    margin: 0,
    padding: "0.75rem 0.9rem",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "color-mix(in srgb, var(--nd-color-text) 65%, transparent)",
    borderBottom: "1px solid color-mix(in srgb, #000 10%, transparent)",
  },
};

export function DetailInspector({ title = "상세 패널", children, className = "", style }: DetailInspectorProps) {
  return (
    <aside className={className} style={{ ...styles.wrapper, ...style }}>
      <p style={styles.title}>{title}</p>
      {children}
    </aside>
  );
}

export type { DetailInspectorProps };
