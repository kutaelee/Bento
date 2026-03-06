import React from "react";
import { SectionCard } from "@nimbus/ui-kit";
import { t } from "../i18n/t";
import "./AdminHomePage.css";

type AdminSection = {
  to: string;
  icon: string;
  titleKey:
    | "admin.users.title"
    | "admin.storage.title"
    | "admin.migration.title"
    | "admin.performance.title"
    | "admin.jobs.title"
    | "admin.audit.title"
    | "admin.security.title"
    | "admin.appearance.title";
  descriptionKey:
    | "admin.home.card.users"
    | "admin.home.card.storage"
    | "admin.home.card.performance"
    | "admin.home.card.jobs"
    | "admin.home.card.security"
    | "admin.home.card.appearance"
    | "admin.storage.title"
    | "admin.audit.title";
};

const sections: AdminSection[] = [
  { to: "/admin/users", icon: "US", titleKey: "admin.users.title", descriptionKey: "admin.home.card.users" },
  { to: "/admin/storage", icon: "ST", titleKey: "admin.storage.title", descriptionKey: "admin.home.card.storage" },
  { to: "/admin/migration", icon: "MG", titleKey: "admin.migration.title", descriptionKey: "admin.storage.title" },
  { to: "/admin/performance", icon: "PF", titleKey: "admin.performance.title", descriptionKey: "admin.home.card.performance" },
  { to: "/admin/jobs", icon: "JB", titleKey: "admin.jobs.title", descriptionKey: "admin.home.card.jobs" },
  { to: "/admin/audit", icon: "AU", titleKey: "admin.audit.title", descriptionKey: "admin.audit.title" },
  { to: "/admin/security", icon: "SC", titleKey: "admin.security.title", descriptionKey: "admin.home.card.security" },
  { to: "/admin/appearance", icon: "AP", titleKey: "admin.appearance.title", descriptionKey: "admin.home.card.appearance" },
];

export function AdminHomePage() {
  return (
    <section className="admin-home">
      <header className="admin-home__header">
        <div>
          <h1 className="admin-home__title">{t("admin.home.title")}</h1>
          <p className="admin-home__subtitle">{t("admin.home.subtitle")}</p>
        </div>
      </header>

      <section className="admin-home__cards" aria-label={t("admin.home.quickLinksTitle")}>
        {sections.map((section) => (
          <SectionCard
            key={section.to}
            to={section.to}
            icon={section.icon}
            title={t(section.titleKey)}
            description={t(section.descriptionKey)}
          />
        ))}
      </section>
    </section>
  );
}
