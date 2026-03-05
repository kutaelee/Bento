import { describe, expect, it } from "vitest";
import { adminSections, adminSettingsLink, quickLinks } from "../nav";
import { adminRoutes, authRoutes, coreRoutes } from "../routes";

describe("IA_NAV_SSOT routing", () => {
  it("matches the core routes order", () => {
    expect(coreRoutes.map((route) => route.path)).toEqual([
      "/files",
      "/files/:nodeId",
      "/search",
      "/recent",
      "/favorites",
      "/shared",
      "/media",
      "/trash",
    ]);
  });

  it("captures auth onboarding routes", () => {
    expect(authRoutes.map((route) => route.path)).toEqual([
      "/login",
      "/setup",
      "/invite/accept",
    ]);

    const invite = authRoutes.find((route) => route.id === "inviteAccept");
    expect(invite?.queryKeys).toEqual(["token"]);
  });

  it("matches admin settings routes", () => {
    expect(adminRoutes.map((route) => route.path)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/storage",
      "/admin/migration",
      "/admin/performance",
      "/admin/jobs",
      "/admin/audit",
      "/admin/security",
      "/admin/appearance",
    ]);
  });
});

describe("IA_NAV_SSOT navigation", () => {
  it("exposes quick links in SSOT order", () => {
    expect(quickLinks.map((item) => item.path)).toEqual([
      "/files",
      "/recent",
      "/favorites",
      "/shared",
      "/media",
      "/trash",
    ]);
  });

  it("keeps the admin settings entry", () => {
    expect(adminSettingsLink.path).toBe("/admin");
    expect(adminSettingsLink.labelKey).toBe("nav.settings");
  });

  it("keeps admin home sections in SSOT order", () => {
    expect(adminSections.map((item) => item.path)).toEqual([
      "/admin/users",
      "/admin/storage",
      "/admin/migration",
      "/admin/performance",
      "/admin/jobs",
      "/admin/audit",
      "/admin/security",
      "/admin/appearance",
    ]);
  });
});
