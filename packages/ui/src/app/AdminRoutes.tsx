import React, { Suspense } from "react";
import { Route } from "react-router-dom";
import type { I18nKey } from "../i18n/t";
import { SimplePage } from "./SimplePage";
import { AdminShell } from "./AdminShell";

// Route-level lazy loading for /admin/* heavy pages
const AdminStoragePage = React.lazy(() => import("./AdminStoragePage"));
const AdminUsersPage = React.lazy(() => import("./AdminUsersPage"));
const AdminMigrationPage = React.lazy(() => import("./AdminMigrationPage"));
const AdminPerformancePage = React.lazy(() => import("./AdminPerformancePage"));
const AdminJobsPage = React.lazy(() => import("./AdminJobsPage"));
const AdminAuditPage = React.lazy(() => import("./AdminAuditPage"));
const AdminSecurityPage = React.lazy(() => import("./AdminSecurityPage"));
const AdminAppearancePage = React.lazy(() => import("./AdminAppearancePage"));

const AdminShellPage = ({
  titleKey,
  children,
}: {
  titleKey: I18nKey;
  children: React.ReactNode;
}) => <AdminShell titleKey={titleKey}>{children}</AdminShell>;

const AdminShellSuspense = ({
  titleKey,
  children,
}: {
  titleKey: I18nKey;
  children: React.ReactNode;
}) => (
  <AdminShellPage titleKey={titleKey}>
    <Suspense fallback={<SimplePage titleKey="setup.loading" />}>{children}</Suspense>
  </AdminShellPage>
);

import { AdminHomePage } from "./AdminHomePage";

export const adminRoutes = (
  <>
    <Route
      path="admin"
      element={
        <AdminShellPage titleKey="admin.home.title">
          <AdminHomePage />
        </AdminShellPage>
      }
    />
    <Route
      path="admin/users"
      element={
        <AdminShellSuspense titleKey="admin.users.title">
          <AdminUsersPage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/storage"
      element={
        <AdminShellSuspense titleKey="admin.storage.title">
          <AdminStoragePage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/migration"
      element={
        <AdminShellSuspense titleKey="admin.migration.title">
          <AdminMigrationPage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/performance"
      element={
        <AdminShellSuspense titleKey="admin.performance.title">
          <AdminPerformancePage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/jobs"
      element={
        <AdminShellSuspense titleKey="admin.jobs.title">
          <AdminJobsPage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/audit"
      element={
        <AdminShellSuspense titleKey="admin.audit.title">
          <AdminAuditPage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/security"
      element={
        <AdminShellSuspense titleKey="admin.security.title">
          <AdminSecurityPage />
        </AdminShellSuspense>
      }
    />
    <Route
      path="admin/appearance"
      element={
        <AdminShellSuspense titleKey="admin.appearance.title">
          <AdminAppearancePage />
        </AdminShellSuspense>
      }
    />
  </>
);
