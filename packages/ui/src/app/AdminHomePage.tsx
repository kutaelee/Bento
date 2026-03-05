import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@nimbus/ui-kit";
import { adminSections } from "../nav";
import { t } from "../i18n/t";
import "./AdminHomePage.css";

export function AdminHomePage() {
  const navigate = useNavigate();

  return (
    <section className="admin-home">
      <header className="admin-home__header">
        <h1 className="admin-home__title">{t("admin.home.title")}</h1>
        <p className="admin-home__subtitle">{t("admin.home.subtitle")}</p>
      </header>

      <section className="admin-home__card" aria-label="admin quick links">
        <h2 className="admin-home__card-title">{t("admin.home.quickLinksTitle")}</h2>
        <p className="admin-home__card-description">{t("admin.home.quickLinksDescription")}</p>
        <ul className="admin-home__quick-links">
          {adminSections.map((item) => (
            <li key={item.id} className="admin-home__quick-link-item">
              <div className="admin-home__quick-link">
                <Link to={item.path} className="admin-home__quick-link-label">
                  {t(item.labelKey)}
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => navigate(item.path)}
                  aria-label={`${t("admin.home.openPage")} ${t(item.labelKey)}`}
                >
                  {t("admin.home.openPage")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
