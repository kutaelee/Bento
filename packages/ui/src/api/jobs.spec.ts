import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "./client";
import { createJobsApi } from "./jobs";

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

describe("jobs api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches job detail", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { id: "job-3", type: "MIGRATION", status: "RUNNING", created_at: "2026-03-01T00:00:00Z" }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createJobsApi(client);

    await api.getJob("job-3");

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:1234/jobs/job-3");
    expect(init?.method).toBe("GET");
  });

  it("fetches full paginated job list", async () => {
    const firstPage = {
      items: [{ id: "job-1", type: "MIGRATION", status: "RUNNING", created_at: "2026-03-02T00:00:00Z" }],
      next_cursor: "next",
    };
    const secondPage = {
      items: [{ id: "job-2", type: "SCAN_CLEANUP", status: "QUEUED", created_at: "2026-03-01T00:00:00Z" }],
      next_cursor: null,
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, firstPage))
      .mockResolvedValueOnce(jsonResponse(200, secondPage));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const client = createApiClient({ baseUrl: "http://localhost:1234" });
    const api = createJobsApi(client);

    const items = await api.listJobs();
    expect(items).toEqual([
      expect.objectContaining({ id: "job-1" }),
      expect.objectContaining({ id: "job-2" }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:1234/jobs");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:1234/jobs?cursor=next");
  });
});
