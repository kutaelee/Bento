import type { I18nKey } from "./i18n/t";

export type NavItem = {
  id: string;
  labelKey: I18nKey;
  path: string;
};

export const quickLinks: NavItem[] = [
  { id: "files", labelKey: "nav.files", path: "/files" },
  { id: "recent", labelKey: "nav.recent", path: "/recent" },
  { id: "favorites", labelKey: "nav.favorites", path: "/favorites" },
  { id: "shared", labelKey: "nav.shared", path: "/shared" },
  { id: "media", labelKey: "nav.media", path: "/media" },
  { id: "trash", labelKey: "nav.trash", path: "/trash" },
];

export const adminSettingsLink: NavItem = {
  id: "admin",
  labelKey: "nav.settings",
  path: "/admin",
};

export const adminSections: NavItem[] = [
  { id: "adminUsers", labelKey: "admin.users.title", path: "/admin/users" },
  {
    id: "adminStorage",
    labelKey: "admin.storage.title",
    path: "/admin/storage",
  },
  {
    id: "adminMigration",
    labelKey: "admin.migration.title",
    path: "/admin/migration",
  },
  {
    id: "adminPerformance",
    labelKey: "admin.performance.title",
    path: "/admin/performance",
  },
  { id: "adminJobs", labelKey: "admin.jobs.title", path: "/admin/jobs" },
  { id: "adminAudit", labelKey: "admin.audit.title", path: "/admin/audit" },
  {
    id: "adminSecurity",
    labelKey: "admin.security.title",
    path: "/admin/security",
  },
  {
    id: "adminAppearance",
    labelKey: "admin.appearance.title",
    path: "/admin/appearance",
  },
];
