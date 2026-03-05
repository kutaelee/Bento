import React from "react";

export type FormFieldProps = {
    label: string;
    help?: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
};

export function FormField({ label, help, error, required, children }: FormFieldProps) {
    return (
        <div style={{ marginBottom: "var(--nd-space-4, 16px)" }}>
            <label
                style={{
                    display: "block",
                    marginBottom: "var(--nd-space-2, 8px)",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--nd-color-text-primary, #111827)",
                }}
            >
                {label}
                {required && <span style={{ color: "var(--nd-color-accent-danger, #ef4444)", marginLeft: "4px" }}>*</span>}
            </label>
            {children}
            {help && !error && (
                <p style={{ margin: "var(--nd-space-1, 4px) 0 0 0", fontSize: "0.75rem", color: "var(--nd-color-text-tertiary, #9ca3af)" }}>
                    {help}
                </p>
            )}
            {error && (
                <p style={{ margin: "var(--nd-space-1, 4px) 0 0 0", fontSize: "0.75rem", color: "var(--nd-color-accent-danger, #ef4444)" }}>
                    {error}
                </p>
            )}
        </div>
    );
}
