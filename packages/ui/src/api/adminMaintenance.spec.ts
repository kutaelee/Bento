import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createAdminMaintenanceApi } from "./adminMaintenance";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("admin maintenance api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts migration", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(202, { id: "job-1", type: "MIGRATION", status: "QUEUED", created_at: "2026-03-01T00:00:00Z" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createAdminMaintenanceApi(client);

    await api.startMigration({
      target_volume_id: "volume-1",
      verify_sha256: false,
      delete_source_after: true,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/migrations");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      target_volume_id: "volume-1",
      verify_sha256: false,
      delete_source_after: true,
    });
  });

  it("starts storage scan", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(202, { id: "job-2", type: "SCAN_CLEANUP", status: "QUEUED", created_at: "2026-03-01T00:00:00Z" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createAdminMaintenanceApi(client);

    await api.scanStorage({ delete_orphan_files: true, delete_orphan_db_rows: false });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/admin/storage/scan");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ delete_orphan_files: true, delete_orphan_db_rows: false });
  });
});
