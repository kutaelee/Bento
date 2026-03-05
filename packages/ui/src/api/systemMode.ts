import { createApiClient } from "./client";
import type { components } from "./schema";

export type SystemMode = components["schemas"]["SystemMode"];

export type UpdateSystemModeRequest = {
  read_only: boolean;
  reason?: string;
};

export const createSystemModeApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    getStatus: async (): Promise<SystemMode> => {
      return client.request<SystemMode>({ path: "/admin/system-mode" });
    },
    updateStatus: async (payload: UpdateSystemModeRequest): Promise<SystemMode> => {
      return client.request<SystemMode>({
        path: "/admin/system-mode",
        method: "PATCH",
        body: payload,
      });
    },
  };
};
