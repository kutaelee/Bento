import React from "react";

export type StatusBadgeProps = {
    status: "ok" | "degraded" | "offline" | "failed" | "pending";
    label?: string; // If not provided, maps to english default string
};

const badgeStyles = {
    ok: { bg: "#dcfce7", color: "#166534", label: "OK" },
    degraded: { bg: "#fef08a", color: "#854d0e", label: "Degraded" },
    offline: { bg: "#e5e7eb", color: "#374151", label: "Offline" },
    failed: { bg: "#fee2e2", color: "#991b1b", label: "Failed" },
    pending: { bg: "#dbeafe", color: "#1e40af", label: "Pending" },
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
    const style = badgeStyles[status];
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 500,
                backgroundColor: style.bg,
                color: style.color,
            }}
        >
            <span
                style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: style.color,
                    marginRight: "6px",
                }}
            />
            {label || style.label}
        </span>
    );
}
