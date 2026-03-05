import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createNodesApi } from "./nodes";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("nodes api createShareLink", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts share link request with options", async () => {
    const link = {
      id: "share-1",
      token: "token-123",
      node_id: "node-123",
      created_at: "2026-03-01T00:00:00Z",
      expires_at: "2026-03-02T00:00:00Z",
      permission: "READ",
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(201, link));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.createShareLink({
      nodeId: "node-123",
      expiresInSeconds: 3600,
      password: "secret123",
    });

    expect(result).toMatchObject({ token: "token-123", node_id: "node-123" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/nodes/node-123/share-links");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ expires_in_seconds: 3600, password: "secret123" });
  });

  it("maps 403 to err.forbidden", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    await expect(nodesApi.createShareLink({ nodeId: "node-123" })).rejects.toMatchObject({
      status: 403,
      key: "err.forbidden",
    });
  });
});
