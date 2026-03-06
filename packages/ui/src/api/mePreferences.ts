import { ApiError } from "./errors";
import { createApiClient } from "./client";
import type { components } from "./schema";

export type User = components["schemas"]["User"];
export type UserPreferencesPatch = components["schemas"]["UserPreferencesPatch"];

export const createMePreferencesApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    getPreferences: async (): Promise<User> => {
      try {
        return await client.request<User>({ path: "/me/preferences" });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return client.request<User>({ path: "/me" });
        }
        throw error;
      }
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
