import { createApiClient } from "./client";
import type { components } from "./schema";

export type StartMigrationRequest = components["schemas"]["StartMigrationRequest"];
export type ScanCleanupRequest = components["schemas"]["ScanCleanupRequest"];
export type Job = components["schemas"]["Job"];

export const createAdminMaintenanceApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    startMigration: async (payload: StartMigrationRequest): Promise<Job> => {
      return client.request<Job>({
        path: "/admin/migrations",
        method: "POST",
        body: payload,
      });
    },
    scanStorage: async (payload?: ScanCleanupRequest): Promise<Job> => {
      return client.request<Job>({
        path: "/admin/storage/scan",
        method: "POST",
        body: payload && Object.keys(payload).length > 0 ? payload : undefined,
      });
    },
  };
};
