import React from "react";

type LoadingSkeletonProps = {
  lines?: number;
  width?: string;
};

const baseStyles: {
  wrapper: React.CSSProperties;
  row: React.CSSProperties;
} = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  row: {
    height: "2.5rem",
    borderRadius: "0.5rem",
    background: "color-mix(in srgb, var(--nd-color-text) 12%, transparent)",
    animation: "0.9s ease-in-out infinite alternate skeletonPulse",
  },
};

export function LoadingSkeleton({ lines = 6, width = "100%" }: LoadingSkeletonProps) {
  return (
    <div style={baseStyles.wrapper} role="status">
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          aria-hidden="true"
          style={{ ...baseStyles.row, width }}
        />
      ))}
    </div>
  );
}

export type { LoadingSkeletonProps };
