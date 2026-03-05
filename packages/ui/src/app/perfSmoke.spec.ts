import { describe, expect, it } from "vitest";
import { perfSmokeRenderList } from "./perfSmoke";

describe("perfSmoke", () => {
  it("renders 5k items deterministically", () => {
    const v = perfSmokeRenderList(5000);
    expect(typeof v).toBe("number");
    // snapshot-like invariant (stable):
    expect(v).toBe(1826922948);
  });
});
