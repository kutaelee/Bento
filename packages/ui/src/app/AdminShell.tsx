import React from "react";
import { ForbiddenState } from "@nimbus/ui-kit";
import { NavLink } from "react-router-dom";
import { adminSections, adminSettingsLink } from "../nav";
import { getVisualState } from "./visualFixtures";
import { t, type I18nKey } from "../i18n/t";
import "./AdminShell.css";

type AdminShellProps = {
  titleKey: I18nKey;
  children: React.ReactNode;
};

export function AdminShell({ titleKey, children }: AdminShellProps) {
  const visualState = getVisualState();
  const body = visualState === "forbidden" ? (
    <ForbiddenState title={t("err.forbidden")} />
  ) : (
    children
  );
  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__section">
          <h2 className="admin-shell__title">{t(adminSettingsLink.labelKey)}</h2>
          <nav className="admin-shell__nav">
            <NavLink
              to={adminSettingsLink.path}
              end
              className={({ isActive }) =>
                `${"admin-shell__link"} ${isActive ? "admin-shell__link--active" : ""}`
              }
            >
              {t(adminSettingsLink.labelKey)}
            </NavLink>
          </nav>
        </div>

        <div className="admin-shell__section">
          <div className="admin-shell__subtitle">Settings</div>
          <nav className="admin-shell__nav">
            {adminSections.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) =>
                  `${"admin-shell__link"} ${isActive ? "admin-shell__link--active" : ""}`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="admin-shell__content" data-title-key={titleKey}>
        <section className="admin-shell__body">{body}</section>
      </main>
    </div>
  );
}
