import { describe, expect, it } from "vitest";
import { getSetupGateDecision } from "./setupGate";

describe("getSetupGateDecision", () => {
  it("allows setup when setup is required", () => {
    expect(getSetupGateDecision(true)).toEqual({ allow: true });
  });

  it("redirects when setup is not required", () => {
    expect(getSetupGateDecision(false)).toEqual({ allow: false, redirectTo: "/login" });
  });
});
