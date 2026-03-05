import React from "react";

export type BottomNavItemProps = {
    id: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    onClick?: () => void;
};

export type BottomNavProps = {
    items: BottomNavItemProps[];
};

export function BottomNav({ items }: BottomNavProps) {
    return (
        <div
            className="nd-bottom-nav"
            style={{
                position: "fixed",
                bottom: 0,
                left: 0,
                right: 0,
                display: "flex",
                backgroundColor: "var(--nd-color-surface-primary, #ffffff)",
                borderTop: "1px solid var(--nd-color-border-default, #e5e7eb)",
                paddingBottom: "env(safe-area-inset-bottom)",
                zIndex: 900,
            }}
            role="navigation"
        >
            {items.map((item) => {
                const activeColor = "var(--nd-color-accent-default, #2563eb)";
                const inactiveColor = "var(--nd-color-text-secondary, #6b7280)";
                return (
                    <button
                        key={item.id}
                        onClick={item.onClick}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "var(--nd-space-2, 8px)",
                            minHeight: "56px", // Touch target size
                            background: "none",
                            border: "none",
                            color: item.isActive ? activeColor : inactiveColor,
                            cursor: "pointer",
                        }}
                        aria-current={item.isActive ? "page" : undefined}
                    >
                        <div style={{ fontSize: "1.25rem", marginBottom: "4px" }}>
                            {item.icon}
                        </div>
                        <span style={{ fontSize: "0.625rem", fontWeight: item.isActive ? 600 : 400 }}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
