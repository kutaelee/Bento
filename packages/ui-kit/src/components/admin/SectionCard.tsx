import React from "react";
import { Link } from "react-router-dom/dist/index";

export type SectionCardProps = {
    title: string;
    description: string;
    icon: string;
    to: string;
};

export function SectionCard({ title, description, icon, to }: SectionCardProps) {
    return (
        <Link
            to={to}
            style={{
                display: "flex",
                alignItems: "flex-start",
                padding: "var(--nd-space-4, 16px)",
                backgroundColor: "var(--nd-color-surface, #ffffff)",
                border: "1px solid var(--nd-color-border-subtle, #e5e7eb)",
                borderRadius: "var(--nd-radius-md, 8px)",
                textDecoration: "none",
                color: "inherit",
                transition: "box-shadow 0.2s, border-color 0.2s",
            }}
            onMouseOver={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.borderColor = "var(--nd-color-border, #d1d5db)";
                e.currentTarget.style.boxShadow = "var(--nd-shadow-sm, 0 1px 2px rgba(0,0,0,0.05))";
            }}
            onMouseOut={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.currentTarget.style.borderColor = "var(--nd-color-border-subtle, #e5e7eb)";
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            <div
                style={{
                    fontSize: "1.5rem",
                    marginRight: "var(--nd-space-4, 16px)",
                    color: "var(--nd-color-text-secondary, #6b7280)",
                }}
            >
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <h3
                    style={{
                        margin: "0 0 var(--nd-space-1, 4px) 0",
                        fontSize: "1rem",
                        fontWeight: 500,
                        color: "var(--nd-color-text-primary, #111827)",
                    }}
                >
                    {title}
                </h3>
                <p
                    style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        color: "var(--nd-color-text-secondary, #6b7280)",
                        lineHeight: 1.4,
                    }}
                >
                    {description}
                </p>
            </div>
            <div
                style={{
                    color: "var(--nd-color-text-tertiary, #9ca3af)",
                    display: "flex",
                    alignItems: "center",
                    height: "100%",
                }}
            >
                ›
            </div>
        </Link>
    );
}
