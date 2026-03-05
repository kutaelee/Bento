import React from "react";
import { SectionCard } from "@nimbus/ui-kit";
import { t } from "../i18n/t";

export function AdminPage() {
    const sections = [
        {
            to: "/admin/users",
            icon: "👥",
            titleKey: "admin.users.title" as const,
            descKey: "admin.users.title" as const, // We don't have separate desc keys, handle fallback below
        },
        {
            to: "/admin/storage",
            icon: "💾",
            titleKey: "admin.storage.title" as const,
            descKey: "admin.storage.title" as const,
        },
        {
            to: "/admin/migration",
            icon: "🚚",
            titleKey: "admin.migration.title" as const,
            descKey: "admin.migration.title" as const,
        },
        {
            to: "/admin/performance",
            icon: "⚡",
            titleKey: "admin.performance.title" as const,
            descKey: "admin.performance.title" as const,
        },
        {
            to: "/admin/jobs",
            icon: "⚙️",
            titleKey: "admin.jobs.title" as const,
            descKey: "admin.jobs.title" as const,
        },
        {
            to: "/admin/audit",
            icon: "📋",
            titleKey: "admin.audit.title" as const,
            descKey: "admin.audit.title" as const,
        },
        {
            to: "/admin/security",
            icon: "🛡️",
            titleKey: "admin.security.title" as const,
            descKey: "admin.security.title" as const,
        },
        {
            to: "/admin/appearance",
            icon: "🎨",
            titleKey: "admin.appearance.title" as const,
            descKey: "admin.appearance.title" as const,
        },
    ];

    return (
        <div style={{ padding: "var(--nd-space-6, 24px)", maxWidth: "1200px", margin: "0 auto" }}>
            <header style={{ marginBottom: "var(--nd-space-6, 24px)" }}>
                <h1 style={{ fontSize: "1.875rem", fontWeight: 600, color: "var(--nd-color-text-primary)" }}>
                    {t("nav.settings")}
                </h1>
            </header>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: "var(--nd-space-4, 16px)",
                }}
            >
                {sections.map((sec) => (
                    <SectionCard
                        key={sec.to}
                        to={sec.to}
                        icon={sec.icon}
                        title={t(sec.titleKey)}
                        description={t(sec.descKey)} // Since we didn't add descriptions to translations, it uses title as fallback
                    />
                ))}
            </div>
        </div>
    );
}
