import React from "react";

type ToolbarProps = {
  children?: React.ReactNode;
  className?: string;
};

const toolbarStyles: {
  wrapper: React.CSSProperties;
} = {
  wrapper: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.4rem 0",
    flexWrap: "wrap",
  },
};

export function Toolbar({ children, className }: ToolbarProps) {
  return (
    <div className={className} style={toolbarStyles.wrapper} role="toolbar">
      {children}
    </div>
  );
}

export type { ToolbarProps };
