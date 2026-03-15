import React from "react";
import { Link } from "react-router-dom";
import { t, type I18nKey } from "../i18n/t";
import "./AdminHomePage.css";

type AdminSection = {
  to: string;
  icon: string;
  tone: "blue" | "violet" | "green" | "rose";
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
    | "admin.home.card.migration"
    | "admin.home.card.performance"
    | "admin.home.card.jobs"
    | "admin.home.card.audit"
    | "admin.home.card.security"
    | "admin.home.card.appearance";
};

const sections: AdminSection[] = [
  { to: "/admin/storage", icon: "ST", tone: "blue", titleKey: "admin.storage.title", descriptionKey: "admin.home.card.storage" },
  { to: "/admin/migration", icon: "MG", tone: "violet", titleKey: "admin.migration.title", descriptionKey: "admin.home.card.migration" },
  { to: "/admin/jobs", icon: "JB", tone: "blue", titleKey: "admin.jobs.title", descriptionKey: "admin.home.card.jobs" },
  { to: "/admin/users", icon: "US", tone: "green", titleKey: "admin.users.title", descriptionKey: "admin.home.card.users" },
  { to: "/admin/security", icon: "SC", tone: "rose", titleKey: "admin.security.title", descriptionKey: "admin.home.card.security" },
  { to: "/admin/audit", icon: "AU", tone: "rose", titleKey: "admin.audit.title", descriptionKey: "admin.home.card.audit" },
  { to: "/admin/performance", icon: "PF", tone: "green", titleKey: "admin.performance.title", descriptionKey: "admin.home.card.performance" },
  { to: "/admin/appearance", icon: "AP", tone: "violet", titleKey: "admin.appearance.title", descriptionKey: "admin.home.card.appearance" },
];

const heroLinks: Array<{ to: string; labelKey: I18nKey; variant: "primary" | "ghost" }> = [
  { to: "/admin/storage", labelKey: "admin.storage.title", variant: "primary" },
  { to: "/admin/jobs", labelKey: "admin.jobs.title", variant: "ghost" },
];

export function AdminHomePage() {
  return (
    <section className="admin-home">
      <header className="admin-home__hero">
        <div className="admin-home__hero-copy">
          <p className="admin-home__eyebrow">{t("nav.settings")}</p>
          <h1 className="admin-home__title">{t("admin.home.title")}</h1>
          <p className="admin-home__subtitle">{t("admin.home.subtitle")}</p>
        </div>
        <div className="admin-home__hero-actions">
          {heroLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={link.variant === "primary" ? "admin-home__action admin-home__action--primary" : "admin-home__action"}
            >
              {t(link.labelKey)}
            </Link>
          ))}
        </div>
      </header>

      <section className="admin-home__highlight">
        <div>
          <p className="admin-home__highlight-label">{t("admin.home.quickLinksTitle")}</p>
          <h2 className="admin-home__highlight-title">{t("admin.home.flowTitle")}</h2>
          <p className="admin-home__highlight-copy">{t("admin.home.flowDescription")}</p>
        </div>
        <div className="admin-home__flow">
          <span className="admin-home__flow-item">{t("admin.storage.title")}</span>
          <span className="admin-home__flow-arrow">/</span>
          <span className="admin-home__flow-item">{t("admin.migration.title")}</span>
          <span className="admin-home__flow-arrow">/</span>
          <span className="admin-home__flow-item">{t("admin.jobs.title")}</span>
        </div>
      </section>

      <section className="admin-home__grid" aria-label={t("admin.home.quickLinksTitle")}>
        {sections.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className={`admin-home__card admin-home__card--${section.tone}`}
          >
            <div className="admin-home__card-icon">{section.icon}</div>
            <div className="admin-home__card-body">
              <h2 className="admin-home__card-title">{t(section.titleKey)}</h2>
              <p className="admin-home__card-description">{t(section.descriptionKey)}</p>
            </div>
            <span className="admin-home__card-arrow">{t("action.open")}</span>
          </Link>
        ))}
      </section>
    </section>
  );
}
