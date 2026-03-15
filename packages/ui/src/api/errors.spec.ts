import { describe, expect, it } from "vitest";
import { mapErrorCodeToKey, mapStatusToErrorKey } from "./errors";

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

  it("maps READ_ONLY code to err.readOnly", () => {
    expect(mapErrorCodeToKey("READ_ONLY", 409)).toBe("err.readOnly");
  });

  it("maps upload conflict codes to err.uploadFailed", () => {
    expect(mapErrorCodeToKey("UPLOAD_INCOMPLETE", 409)).toBe("err.uploadFailed");
    expect(mapErrorCodeToKey("CHUNK_CONFLICT", 409)).toBe("err.uploadFailed");
    expect(mapErrorCodeToKey("CHECKSUM_MISMATCH", 409)).toBe("err.uploadFailed");
  });

  it("maps 429 to err.rateLimited", () => {
    expect(mapStatusToErrorKey(429)).toBe("err.rateLimited");
  });
});
