import React from "react";
import { t, type I18nKey } from "../i18n/t";
import "./AuthLayout.css";

type AuthLayoutProps = {
  titleKey: I18nKey;
  subtitleKey: I18nKey;
  status?: React.ReactNode;
  sidebarTitleKey?: I18nKey;
  sidebarBodyKey?: I18nKey;
  sidebarItems?: Array<{ labelKey: I18nKey; value: string }>;
  children: React.ReactNode;
};

export function AuthLayout({
  titleKey,
  subtitleKey,
  status,
  sidebarTitleKey = "app.brand",
  sidebarBodyKey = "msg.authShellBody",
  sidebarItems = [],
  children,
}: AuthLayoutProps) {
  return (
    <main className="auth-layout">
      <section className="auth-layout__hero">
        <div className="auth-layout__hero-panel">
          <div className="auth-layout__eyebrow">{t("app.brand")}</div>
          <h1 className="auth-layout__hero-title">{t(sidebarTitleKey)}</h1>
          <p className="auth-layout__hero-body">{t(sidebarBodyKey)}</p>
          <div className="auth-layout__hero-grid">
            {sidebarItems.map((item) => (
              <div key={item.labelKey} className="auth-layout__metric">
                <span className="auth-layout__metric-label">{t(item.labelKey)}</span>
                <strong className="auth-layout__metric-value">{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="auth-layout__content">
        <div className="auth-layout__card">
          <div className="auth-layout__header">
            <h2 className="auth-layout__title">{t(titleKey)}</h2>
            <p className="auth-layout__subtitle">{t(subtitleKey)}</p>
          </div>
          {status ? <div className="auth-layout__status">{status}</div> : null}
          {children}
        </div>
      </section>
    </main>
  );
}
