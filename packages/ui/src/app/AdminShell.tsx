import React from "react";
import { ForbiddenState } from "@nimbus/ui-kit";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { createAuthApi } from "../api/auth";
import { adminSections, adminSettingsLink } from "../nav";
import { clearAuthTokens } from "./authTokens";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { getVisualFixtureSearch, getVisualState } from "./visualFixtures";
import { t, type I18nKey } from "../i18n/t";
import "./AdminShell.css";

type AdminShellProps = {
  titleKey: I18nKey;
  children: React.ReactNode;
};

const sectionIcons: Record<string, string> = {
  admin: "dashboard",
  adminUsers: "group",
  adminStorage: "hard_drive",
  adminMigration: "sync_alt",
  adminPerformance: "monitoring",
  adminJobs: "task_alt",
  adminAudit: "receipt_long",
  adminSecurity: "verified_user",
  adminAppearance: "palette",
};

export function AdminShell({ titleKey, children }: AdminShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const visualState = getVisualState();
  const preservedSearch = React.useMemo(() => getVisualFixtureSearch(location.search), [location.search]);
  const apiClient = React.useMemo(() => getAuthenticatedApiClient(), []);
  const authApi = React.useMemo(() => createAuthApi(apiClient), [apiClient]);
  const sections = [adminSettingsLink, ...adminSections];
  const body = visualState === "forbidden" ? (
    <ForbiddenState title={t("err.forbidden")} descKey={t("msg.forbiddenAdmin")} />
  ) : (
    children
  );

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local session even if the backend already revoked it.
    } finally {
      clearAuthTokens();
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="admin-shell">
      <aside className="admin-shell__sidebar">
        <div className="admin-shell__sidebar-top">
          <NavLink to={{ pathname: "/files", search: preservedSearch }} className="admin-shell__brand">
            <span className="admin-shell__brand-mark">B</span>
            <span className="admin-shell__brand-copy">
              <strong>Bento</strong>
              <small>{t("nav.settings")}</small>
            </span>
          </NavLink>

          <nav className="admin-shell__nav" aria-label={t("admin.home.quickLinksTitle")}>
            {sections.map((item) => (
              <NavLink
                key={item.id}
                to={{ pathname: item.path, search: preservedSearch }}
                end={item.path === adminSettingsLink.path}
                className={({ isActive }) => `${"admin-shell__link"}${isActive ? " admin-shell__link--active" : ""}`}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {sectionIcons[item.id] ?? "circle"}
                </span>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <NavLink to={{ pathname: "/files", search: preservedSearch }} className="admin-shell__backlink">
          <span className="material-symbols-outlined" aria-hidden="true">arrow_back</span>
          <span>{t("nav.files")}</span>
        </NavLink>
      </aside>

      <main className="admin-shell__content" data-title-key={titleKey}>
        <header className="admin-shell__header">
          <div>
            <p className="admin-shell__eyebrow">{t("nav.settings")}</p>
            <h1 className="admin-shell__title">{t(titleKey)}</h1>
          </div>
          <div className="admin-shell__header-actions">
            <div className="admin-shell__header-meta">
              <span>{t("admin.home.quickLinksTitle")}</span>
              <strong>{sections.length}</strong>
            </div>
            <button type="button" className="admin-shell__logout" onClick={() => void handleLogout()}>
              {t("action.signOut")}
            </button>
          </div>
        </header>

        <section className="admin-shell__body">{body}</section>
      </main>
    </div>
  );
}
