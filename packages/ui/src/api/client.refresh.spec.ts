import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("api client auth refresh", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retries once after 401 by calling /auth/refresh and updating token", async () => {
    let token: string | null = "old";
    let refreshToken: string | null = "rt";

    const fetchMock = vi
      .fn()
      // original request -> 401
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      // refresh -> 200
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "new", refresh_token: "rt2", token_type: "Bearer", expires_in_seconds: 3600 }))
      // retry -> 200
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({
      baseUrl: "http://localhost:1234",
      getToken: () => token,
      setToken: (t) => {
        token = t;
      },
      getRefreshToken: () => refreshToken,
      setRefreshToken: (t) => {
        refreshToken = t;
      },
    });

    const res = await client.request<{ ok: boolean }>({ path: "/protected" });
    expect(res.ok).toBe(true);

    expect(token).toBe("new");
    expect(refreshToken).toBe("rt2");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:1234/auth/refresh");
  });

  it("serializes concurrent refresh attempts", async () => {
    let token: string | null = "old";
    let refreshToken: string | null = "rt";

    let protectedCalls = 0;
    const fetchMock = vi.fn().mockImplementation((url: RequestInfo) => {
      if (typeof url === "string" && url.endsWith("/auth/refresh")) {
        return Promise.resolve(jsonResponse(200, { access_token: "new", refresh_token: "rt2", token_type: "Bearer", expires_in_seconds: 3600 }));
      }

      protectedCalls += 1;
      if (protectedCalls <= 2) {
        return Promise.resolve(new Response("", { status: 401 }));
      }

      return Promise.resolve(jsonResponse(200, { ok: true }));
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({
      baseUrl: "http://localhost:1234",
      getToken: () => token,
      setToken: (t) => {
        token = t;
      },
      getRefreshToken: () => refreshToken,
      setRefreshToken: (t) => {
        refreshToken = t;
      },
    });

    const [first, second] = await Promise.all([
      client.request<{ ok: boolean }>({ path: "/protected" }),
      client.request<{ ok: boolean }>({ path: "/protected" }),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const refreshCalls = fetchMock.mock.calls.filter((call) => call[0] === "http://localhost:1234/auth/refresh");
    expect(refreshCalls).toHaveLength(1);
    expect(token).toBe("new");
    expect(refreshToken).toBe("rt2");
  });

  it("clears tokens and calls onAuthFailure when refresh fails", async () => {
    let token: string | null = "old";
    let refreshToken: string | null = "rt";
    const onAuthFailure = vi.fn();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({
      baseUrl: "http://localhost:1234",
      getToken: () => token,
      setToken: (t) => {
        token = t;
      },
      getRefreshToken: () => refreshToken,
      setRefreshToken: (t) => {
        refreshToken = t;
      },
      onAuthFailure,
    });

    await expect(client.request({ path: "/protected" })).rejects.toMatchObject({ status: 401 });

    expect(token).toBe(null);
    expect(refreshToken).toBe(null);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
