import { createApiClient } from "./client";
import type { components } from "./schema";

export type User = components["schemas"]["User"];
export type UserPreferencesPatch = components["schemas"]["UserPreferencesPatch"];

export const createMePreferencesApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    getPreferences: async (): Promise<User> => {
      return client.request<User>({ path: "/me" });
    },
    setPreferences: async (payload: UserPreferencesPatch): Promise<User> => {
      return client.request<User>({
        path: "/me/preferences",
        method: "PATCH",
        body: payload,
      });
    },
  };
};
