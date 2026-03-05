import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createVolumesApi } from "./volumes";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("volumes api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("lists volumes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            id: "11111111-1111-1111-1111-111111111111",
            name: "Primary",
            base_path: "/mnt/data",
            is_active: true,
            status: "OK",
            created_at: "2026-03-01T00:00:00Z",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createVolumesApi(client);

    const result = await api.listVolumes();

    expect(result.items).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/volumes");
    expect(init?.method).toBe("GET");
  });

  it("validates storage path", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        ok: true,
        writable: true,
        free_bytes: 1024,
        total_bytes: 2048,
        fs_type: "ext4",
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createVolumesApi(client);

    const result = await api.validatePath({ base_path: "/mnt/data" });

    expect(result.writable).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/volumes/validate-path");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ base_path: "/mnt/data" });
  });

  it("maps validate path failures to err.validation", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createVolumesApi(client);

    await expect(api.validatePath({ base_path: "/invalid" })).rejects.toMatchObject({
      status: 400,
      key: "err.validation",
    });
  });

  it("activates volume", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        id: "22222222-2222-2222-2222-222222222222",
        name: "Backup",
        base_path: "/mnt/backup",
        is_active: true,
        status: "OK",
        created_at: "2026-03-01T00:00:00Z",
      }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createVolumesApi(client);

    const result = await api.activateVolume("22222222-2222-2222-2222-222222222222");

    expect(result.is_active).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/volumes/22222222-2222-2222-2222-222222222222/activate");
    expect(init?.method).toBe("POST");
  });
});
