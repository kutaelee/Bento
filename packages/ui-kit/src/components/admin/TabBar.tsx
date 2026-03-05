import React from "react";

export type TabItem = {
    id: string;
    label: string;
};

export type TabBarProps = {
    tabs: TabItem[];
    activeId: string;
    onChange: (id: string) => void;
};

export function TabBar({ tabs, activeId, onChange }: TabBarProps) {
    return (
        <div
            style={{
                display: "flex",
                borderBottom: "1px solid var(--nd-color-border-subtle, #e5e7eb)",
                marginBottom: "var(--nd-space-4, 16px)",
            }}
        >
            {tabs.map((tab) => {
                const isActive = tab.id === activeId;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onChange(tab.id)}
                        style={{
                            padding: "var(--nd-space-3, 12px) var(--nd-space-4, 16px)",
                            background: "none",
                            border: "none",
                            borderBottom: isActive
                                ? "2px solid var(--nd-color-accent-default, #2563eb)"
                                : "2px solid transparent",
                            color: isActive
                                ? "var(--nd-color-accent-default, #2563eb)"
                                : "var(--nd-color-text-secondary, #6b7280)",
                            fontWeight: isActive ? 600 : 500,
                            cursor: "pointer",
                            transition: "border-color 0.2s, color 0.2s",
                        }}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
