import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createNodesApi } from "./nodes";

describe("nodes api download", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests download with range and returns blob", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(new Blob(["file-bytes"], { type: "application/octet-stream" }), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({
      baseUrl: "http://localhost:1234",
      getToken: () => "token-123",
    });
    const nodesApi = createNodesApi(client);

    const result = await nodesApi.downloadNode({
      nodeId: "node-1",
      range: "bytes=0-9",
    });

    expect(await result.text()).toBe("file-bytes");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/nodes/node-1/download");
    expect(init?.method).toBe("GET");

    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer token-123");
    expect(headers["Accept-Language"]).toBe("ko-KR");
    expect(headers.Range).toBe("bytes=0-9");
  });
});
