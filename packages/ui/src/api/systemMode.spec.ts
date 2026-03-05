import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createSystemModeApi } from "./systemMode";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("system mode api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches system mode status", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { read_only: true, updated_at: "2026-03-01T00:00:00Z" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createSystemModeApi(client);

    const result = await api.getStatus();

    expect(result.read_only).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/system-mode");
    expect(init?.method).toBe("GET");
  });

  it("updates system mode", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { read_only: false, updated_at: "2026-03-01T00:01:00Z" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createSystemModeApi(client);

    const result = await api.updateStatus({ read_only: false });

    expect(result.read_only).toBe(false);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/system-mode");
    expect(init?.method).toBe("PATCH");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ read_only: false });
  });

  it("maps 403 to err.forbidden", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createSystemModeApi(client);

    await expect(api.getStatus()).rejects.toMatchObject({ status: 403, key: "err.forbidden" });
  });
});
