import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createNodesApi } from "./nodes";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("nodes api renameNode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts rename request and returns node", async () => {
    const node = {
      id: "node-123",
      type: "FOLDER",
      name: "Renamed folder",
      parent_id: "parent-1",
      path: "root.node-123",
      created_at: "2026-02-28T00:00:00Z",
      updated_at: "2026-02-28T00:00:00Z",
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, node));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.renameNode({ nodeId: "node-123", newName: "Renamed folder" });

    expect(result).toMatchObject({ id: "node-123", name: "Renamed folder" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/nodes/node-123/rename");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ new_name: "Renamed folder" });
  });

  it("maps 409 to err.conflict", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 409 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    await expect(
      nodesApi.renameNode({ nodeId: "node-123", newName: "Existing" }),
    ).rejects.toMatchObject({ status: 409, key: "err.conflict" });
  });
});
