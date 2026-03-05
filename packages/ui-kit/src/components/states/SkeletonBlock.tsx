import React from "react";

export type SkeletonBlockProps = {
    width?: string | number;
    height?: string | number;
    radius?: "base" | "lg" | "xl" | "full";
    variant?: "line" | "card" | "table-row" | "avatar";
    className?: string;
    style?: React.CSSProperties;
};

const variantDefaults: Record<NonNullable<SkeletonBlockProps["variant"]>, { width: string; height: string; radius: SkeletonBlockProps["radius"] }> = {
    line: { width: "100%", height: "1rem", radius: "base" },
    card: { width: "100%", height: "9rem", radius: "lg" },
    "table-row": { width: "100%", height: "2.5rem", radius: "base" },
    avatar: { width: "2.5rem", height: "2.5rem", radius: "full" },
};

export function SkeletonBlock({ width, height, radius, variant = "line", className, style, ...props }: SkeletonBlockProps) {
    const defaults = variantDefaults[variant];
    const inlineStyle: React.CSSProperties = {
        width: width ?? defaults.width,
        height: height ?? defaults.height,
        backgroundColor: "var(--nd-color-surface-tertiary)",
        borderRadius: `var(--nd-radius-${radius ?? defaults.radius})`,
        animation: "nd-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        display: "inline-block",
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
