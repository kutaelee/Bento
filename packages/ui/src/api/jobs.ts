import { createApiClient } from "./client";
import type { components } from "./schema";

export type Job = components["schemas"]["Job"];
export type JobStatus = components["schemas"]["JobStatus"];
export type ListJobsResponse = components["schemas"]["ListJobsResponse"];

export const createJobsApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    listJobs: async (): Promise<Job[]> => {
      const jobs: Job[] = [];
      let cursor: string | null = null;

      do {
        const params = new URLSearchParams();
        if (cursor) {
          params.set("cursor", cursor);
        }

        const query = params.toString();
        const path = query ? `/jobs?${query}` : "/jobs";
        const response = await client.request<ListJobsResponse>({ path });

        jobs.push(...response.items);
        cursor = response.next_cursor;
      } while (cursor);

      return jobs;
    },
    getJob: async (jobId: string): Promise<Job> => {
      return client.request<Job>({ path: `/jobs/${jobId}` });
    },
  };
};
