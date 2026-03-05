import React from "react";

export type DangerZoneProps = {
    title: string;
    description?: string;
    children: React.ReactNode;
};

export function DangerZone({ title, description, children }: DangerZoneProps) {
    return (
        <section
            style={{
                border: "1px solid var(--nd-color-accent-danger, #ef4444)",
                borderRadius: "var(--nd-radius-md, 8px)",
                padding: "var(--nd-space-4, 16px)",
                marginTop: "var(--nd-space-8, 32px)",
                backgroundColor: "rgba(239, 68, 68, 0.05)",
            }}
        >
            <h3
                style={{
                    margin: "0 0 var(--nd-space-2, 8px) 0",
                    fontSize: "1.125rem",
                    fontWeight: 600,
                    color: "var(--nd-color-accent-danger, #ef4444)",
                }}
            >
                {title}
            </h3>
            {description && (
                <p
                    style={{
                        margin: "0 0 var(--nd-space-4, 16px) 0",
                        fontSize: "0.875rem",
                        color: "var(--nd-color-text-secondary, #6b7280)",
                    }}
                >
                    {description}
                </p>
            )}
            <div>{children}</div>
        </section>
    );
}
