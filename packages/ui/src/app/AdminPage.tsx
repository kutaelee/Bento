import React from "react";
import { SectionCard } from "@nimbus/ui-kit";
import { t } from "../i18n/t";

const sections = [
  { to: "/admin/users", icon: "US", titleKey: "admin.users.title" as const, descKey: "admin.home.card.users" as const },
  { to: "/admin/storage", icon: "ST", titleKey: "admin.storage.title" as const, descKey: "admin.home.card.storage" as const },
  { to: "/admin/migration", icon: "MG", titleKey: "admin.migration.title" as const, descKey: "admin.storage.title" as const },
  { to: "/admin/performance", icon: "PF", titleKey: "admin.performance.title" as const, descKey: "admin.home.card.performance" as const },
  { to: "/admin/jobs", icon: "JB", titleKey: "admin.jobs.title" as const, descKey: "admin.home.card.jobs" as const },
  { to: "/admin/audit", icon: "AU", titleKey: "admin.audit.title" as const, descKey: "admin.audit.title" as const },
  { to: "/admin/security", icon: "SC", titleKey: "admin.security.title" as const, descKey: "admin.home.card.security" as const },
  { to: "/admin/appearance", icon: "AP", titleKey: "admin.appearance.title" as const, descKey: "admin.home.card.appearance" as const },
];

export function AdminPage() {
  return (
    <div style={{ padding: "var(--nd-space-6, 24px)", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ marginBottom: "var(--nd-space-6, 24px)" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: 600, color: "var(--nd-color-text-primary)" }}>
          {t("nav.settings")}
        </h1>
        <p style={{ marginTop: 8, color: "var(--nd-color-text-secondary)" }}>{t("admin.home.subtitle")}</p>
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
            description={t(sec.descKey)}
          />
        ))}
      </div>
    </div>
  );
}
