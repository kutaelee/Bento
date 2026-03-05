import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { colors, radii, typography } from "./";

describe("token exports", () => {
  it("exports core color tokens", () => {
    expect(colors.semantic.accent.default.light).toBe("#137fec");
    expect(colors.semantic.status.success.light).toBe("#10b981");
    expect(colors.semantic.status.warning.light).toBe("#f59e0b");
    expect(colors.semantic.status.danger.light).toBe("#f43f5e");
  });

  it("exports radius tokens", () => {
    expect(radii.base).toBe("4px");
    expect(radii.full).toBe("9999px");
  });

  it("loads typography tokens", () => {
    expect(typography.fontFamily.display.join(", ")).toContain("Inter");
    expect(typography.size.h1).toBe("24px");
  });

  it("global css contains css variables", () => {
    const css = readFileSync(resolve(__dirname, "../styles/global.css"), "utf8");
    expect(css).toContain("--nd-color-primary");
    expect(css).toContain("--nd-radius-lg");
    expect(css).toContain("--nd-font-family-display");
  });
});
