import { describe, expect, it } from "vitest";
import { mapStatusToErrorKey } from "./errors";

describe("mapStatusToErrorKey", () => {
  it("maps 401 to err.unauthorized", () => {
    expect(mapStatusToErrorKey(401)).toBe("err.unauthorized");
  });

  it("maps 403 to err.forbidden", () => {
    expect(mapStatusToErrorKey(403)).toBe("err.forbidden");
  });

  it("maps 404 to err.notFound", () => {
    expect(mapStatusToErrorKey(404)).toBe("err.notFound");
  });

  it("maps 409 to err.conflict", () => {
    expect(mapStatusToErrorKey(409)).toBe("err.conflict");
  });

  it("maps 429 to err.rateLimited", () => {
    expect(mapStatusToErrorKey(429)).toBe("err.rateLimited");
  });
});
