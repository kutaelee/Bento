import React from "react";

export type SkeletonBlockProps = {
    width?: string | number;
    height?: string | number;
    radius?: "base" | "lg" | "xl" | "full";
    className?: string;
    style?: React.CSSProperties;
};

export function SkeletonBlock({ width = "100%", height = "100%", radius = "base", className, style, ...props }: SkeletonBlockProps) {
    const inlineStyle: React.CSSProperties = {
        width,
        height,
        backgroundColor: "var(--nd-color-surface-tertiary)",
        borderRadius: `var(--nd-radius-${radius})`,
        animation: "nd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ...style,
    };

    return (
        <div
            className={className}
            style={inlineStyle}
            {...props}
        />
    );
}
