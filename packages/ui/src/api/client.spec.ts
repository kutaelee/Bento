import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "./errors";
import { createApiClient } from "./client";

type FetchArgs = Parameters<typeof fetch>;

const mockFetch = (handler: (...args: FetchArgs) => Promise<Response>) => {
  vi.stubGlobal("fetch", vi.fn(handler));
};

describe("api client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds auth + locale headers", async () => {
    mockFetch(async (_input, init) => {
      const headers = new Headers(init?.headers as HeadersInit);
      expect(headers.get("Authorization")).toBe("Bearer token");
      expect(headers.get("Accept-Language")).toBe("en-US");
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const client = createApiClient({
      baseUrl: "http://localhost:8080",
      getToken: () => "token",
      getLocale: () => "en-US",
    });

    const result = await client.request<{ ok: boolean }>({ path: "/health" });
    expect(result.ok).toBe(true);
  });

  it("throws ApiError with mapped key", async () => {
    mockFetch(async () => new Response("", { status: 409 }));

    const client = createApiClient({ baseUrl: "http://localhost:8080" });

    await expect(client.request({ path: "/conflict" })).rejects.toBeInstanceOf(
      ApiError
    );

    await expect(client.request({ path: "/conflict" })).rejects.toMatchObject({
      status: 409,
      key: "err.conflict",
    });
  });

  it("maps structured READ_ONLY errors to err.readOnly", async () => {
    mockFetch(async () =>
      new Response(JSON.stringify({ error: { code: "READ_ONLY", message: "System is in read-only mode" } }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createApiClient({ baseUrl: "http://localhost:8080" });

    await expect(client.request({ path: "/uploads", method: "POST" })).rejects.toMatchObject({
      status: 409,
      key: "err.readOnly",
      code: "READ_ONLY",
      message: "System is in read-only mode",
    });
  });
});
