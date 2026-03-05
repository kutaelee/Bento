import { createApiClient } from "./client";
import type { components } from "./schema";

type User = components["schemas"]["User"];

export type AuthTokens = components["schemas"]["AuthTokens"];

export type StoredAuthTokens = AuthTokens;

export type AcceptInviteResponse = {
  user: User;
  tokens: AuthTokens;
};

export type AcceptInviteRequest = components["schemas"]["AcceptInviteRequest"];

export const createAuthApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    acceptInvite: async (payload: AcceptInviteRequest): Promise<AcceptInviteResponse> => {
      return client.request<AcceptInviteResponse>({
        path: "/auth/accept-invite",
        method: "POST",
        body: payload,
      });
    },
    refresh: async (refreshToken: string): Promise<AuthTokens> => {
      return client.request<AuthTokens>({
        path: "/auth/refresh",
        method: "POST",
        body: { refresh_token: refreshToken },
      });
    },

    logout: async (): Promise<void> => {
      await client.request({
        path: "/auth/logout",
        method: "POST",
      });
    },
  };
};
