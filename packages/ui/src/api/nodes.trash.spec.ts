import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createNodesApi } from "./nodes";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("nodes api trash", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists trash with cursor and limit", async () => {
    const payload = { items: [], next_cursor: null };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, payload));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.listTrash({ cursor: "next", limit: 50 });
    expect(result).toEqual(payload);

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/trash?cursor=next&limit=50");
  });

  it("restores trash node with idempotency key", async () => {
    const node = {
      id: "node-1",
      type: "FOLDER",
      name: "Restored",
      parent_id: "parent-1",
      path: "root.node-1",
      created_at: "2026-02-28T00:00:00Z",
      updated_at: "2026-02-28T00:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, node));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.restoreTrash({ nodeId: "node-1", idempotencyKey: "abc" });
    expect(result).toMatchObject({ id: "node-1" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/trash/node-1/restore");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "abc" });
  });

  it("deletes trash node permanently", async () => {
    const job = {
      id: "job-1",
      type: "TRASH_GC",
      status: "QUEUED",
      created_at: "2026-02-28T00:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(202, job));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.deleteTrash({ nodeId: "node-1" });
    expect(result).toMatchObject({ id: "job-1", type: "TRASH_GC" });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/trash/node-1");
    expect(init?.method).toBe("DELETE");
  });
});
