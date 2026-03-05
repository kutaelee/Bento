import { createApiClient } from "./client";
import type { components } from "./schema";
import type { StoredAuthTokens } from "./auth";

type User = components["schemas"]["User"];

export type SetupStatus = components["schemas"]["SetupStatus"];

export type CreateAdminRequest = components["schemas"]["CreateAdminRequest"];

export type CreateAdminResponse = {
  user: User;
  tokens: StoredAuthTokens;
};

export const createSetupApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    status: async (): Promise<SetupStatus> => {
      return client.request<SetupStatus>({ path: "/setup/status" });
    },
    createAdmin: async (payload: CreateAdminRequest): Promise<CreateAdminResponse> => {
      return client.request<CreateAdminResponse>({
        path: "/setup/admin",
        method: "POST",
        body: payload,
      });
    },
  };
};
