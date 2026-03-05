import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../api/client";
import { createUploadsApi } from "../api/uploads";
import { uploadFile } from "./uploadQueue";

describe("uploadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates session, uploads chunk, and completes", async () => {
    const digestBuffer = new Uint8Array(32).fill(1).buffer;
    vi.stubGlobal("crypto", {
      subtle: {
        digest: vi.fn().mockResolvedValue(digestBuffer),
      },
    } as unknown as Crypto);

    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      void _init;
      const resolvedUrl = String(url);
      if (resolvedUrl.endsWith("/uploads")) {
        return new Response(
          JSON.stringify({
            upload_id: "upload-123",
            status: "INIT",
            chunk_size_bytes: 5,
            total_chunks: 1,
            received_chunks: [],
            dedup_hit: false,
          }),
          {
            status: 201,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (resolvedUrl.endsWith("/uploads/upload-123/chunks/0")) {
        return new Response(
          JSON.stringify({
            upload_id: "upload-123",
            status: "UPLOADING",
            size_bytes: 3,
            chunk_size_bytes: 5,
            total_chunks: 1,
            received_chunks: [0],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (resolvedUrl.endsWith("/uploads/upload-123/complete")) {
        return new Response(
          JSON.stringify({
            node_id: "node-1",
            blob_id: "blob-1",
            sha256: "sha",
            size_bytes: 3,
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      throw new Error(`unexpected url: ${resolvedUrl}`);
    });

    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({
      baseUrl: "http://localhost:1234",
      getToken: () => "token",
    });
    const uploadsApi = createUploadsApi({ client });

    const file = Object.assign(
      new Blob([new Uint8Array([1, 2, 3])], { type: "text/plain" }),
      { name: "hello.txt", lastModified: 1710000000000 },
    ) as File;

    await uploadFile({ file, parentId: "root", uploadsApi });

    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [createUrl, createInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(createUrl)).toContain("/uploads");
    expect(createInit?.method).toBe("POST");

    const [chunkUrl, chunkInit] = fetchMock.mock.calls[1] ?? [];
    expect(String(chunkUrl)).toContain("/uploads/upload-123/chunks/0");
    expect(chunkInit?.method).toBe("PUT");
    const chunkHeaders = chunkInit?.headers as Record<string, string>;
    expect(chunkHeaders["X-Chunk-SHA256"]).toBe("01".repeat(32));

    const [completeUrl, completeInit] = fetchMock.mock.calls[2] ?? [];
    expect(String(completeUrl)).toContain("/uploads/upload-123/complete");
    expect(completeInit?.method).toBe("POST");
  });
});
