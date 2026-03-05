import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createNodesApi } from "./nodes";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("nodes api copyNode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts copy request and returns node", async () => {
    const node = {
      id: "node-123",
      type: "FOLDER",
      name: "Copied folder",
      parent_id: "parent-2",
      path: "root.node-456.node-123",
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    };

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, node));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.copyNode({
      nodeId: "node-123",
      destinationParentId: "parent-2",
    });

    expect(result).toMatchObject({ id: "node-123", parent_id: "parent-2" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/nodes/node-123/copy");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ destination_parent_id: "parent-2" });
  });

  it("maps 409 to err.conflict", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 409 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    await expect(
      nodesApi.copyNode({ nodeId: "node-123", destinationParentId: "parent-2" }),
    ).rejects.toMatchObject({ status: 409, key: "err.conflict" });
  });
});
