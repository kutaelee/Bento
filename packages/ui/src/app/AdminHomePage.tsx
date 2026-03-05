import React from "react";
import { SectionCard } from "@nimbus/ui-kit";
import { t } from "../i18n/t";
import "./AdminHomePage.css";

export function AdminHomePage() {
  const sections = [
    {
      to: "/admin/users",
      icon: "👥",
      title: t("admin.users.title"),
      description: t("admin.home.card.users"),
    },
    {
      to: "/admin/storage",
      icon: "💾",
      title: t("admin.storage.title"),
      description: t("admin.home.card.storage"),
    },
    {
      to: "/admin/performance",
      icon: "⚡",
      title: t("admin.performance.title"),
      description: t("admin.home.card.performance"),
    },
    {
      to: "/admin/jobs",
      icon: "⚙️",
      title: t("admin.jobs.title"),
      description: t("admin.home.card.jobs"),
    },
    {
      to: "/admin/security",
      icon: "🛡️",
      title: t("admin.security.title"),
      description: t("admin.home.card.security"),
    },
    {
      to: "/admin/appearance",
      icon: "🎨",
      title: t("admin.appearance.title"),
      description: t("admin.home.card.appearance"),
    },
  ];

  return (
    <section className="admin-home">
      <header className="admin-home__header">
        <h1 className="admin-home__title">{t("admin.home.title")}</h1>
        <p className="admin-home__subtitle">{t("admin.home.subtitle")}</p>
      </header>

      <section className="admin-home__cards" aria-label={t("admin.home.quickLinksTitle")}>
        {sections.map((section) => (
          <SectionCard
            key={section.to}
            to={section.to}
            icon={section.icon}
            title={section.title}
            description={section.description}
          />
        ))}
      </section>
    </section>
  );
}
