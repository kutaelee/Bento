export type RouteGroup = "core" | "auth" | "admin";

export type RouteDefinition = {
  id: string;
  path: string;
  group: RouteGroup;
  queryKeys?: string[];
};

export const coreRoutes: RouteDefinition[] = [
  { id: "files", path: "/files", group: "core" },
  { id: "filesNode", path: "/files/:nodeId", group: "core" },
  { id: "search", path: "/search", group: "core", queryKeys: ["q"] },
  { id: "recent", path: "/recent", group: "core" },
  { id: "favorites", path: "/favorites", group: "core" },
  { id: "shared", path: "/shared", group: "core" },
  { id: "media", path: "/media", group: "core" },
  { id: "trash", path: "/trash", group: "core" },
];

export const authRoutes: RouteDefinition[] = [
  { id: "login", path: "/login", group: "auth" },
  { id: "setup", path: "/setup", group: "auth" },
  {
    id: "inviteAccept",
    path: "/invite/accept",
    group: "auth",
    queryKeys: ["token"],
  },
];

export const adminRoutes: RouteDefinition[] = [
  { id: "adminHome", path: "/admin", group: "admin" },
  { id: "adminUsers", path: "/admin/users", group: "admin" },
  { id: "adminStorage", path: "/admin/storage", group: "admin" },
  { id: "adminMigration", path: "/admin/migration", group: "admin" },
  { id: "adminPerformance", path: "/admin/performance", group: "admin" },
  { id: "adminJobs", path: "/admin/jobs", group: "admin" },
  { id: "adminAudit", path: "/admin/audit", group: "admin" },
  { id: "adminSecurity", path: "/admin/security", group: "admin" },
  { id: "adminAppearance", path: "/admin/appearance", group: "admin" },
];

export const allRoutes: RouteDefinition[] = [
  ...coreRoutes,
  ...authRoutes,
  ...adminRoutes,
];
