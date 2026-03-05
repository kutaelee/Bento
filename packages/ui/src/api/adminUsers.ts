import { createApiClient } from "./client";
import type { components } from "./schema";

export type AdminUser = components["schemas"]["User"];
export type Invite = components["schemas"]["Invite"];
export type ListUsersResponse = {
  items: AdminUser[];
};

export const createAdminUsersApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    listUsers: async (): Promise<ListUsersResponse> => {
      return client.request<ListUsersResponse>({
        path: "/admin/users",
      });
    },
    createInvite: async (payload: components["schemas"]["CreateInviteRequest"]): Promise<Invite> => {
      return client.request<Invite>({
        path: "/admin/invites",
        method: "POST",
        body: payload,
      });
    },
  };
};
