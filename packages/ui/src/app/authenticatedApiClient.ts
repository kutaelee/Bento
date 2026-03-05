import { createApiClient } from "../api/client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./authTokens";

let sharedClient: ReturnType<typeof createApiClient> | null = null;

export function getAuthenticatedApiClient() {
  if (!sharedClient) {
    sharedClient = createApiClient({
      baseUrl: "",
      getToken: getAccessToken,
      setToken: setAccessToken,
      getRefreshToken: getRefreshToken,
      setRefreshToken: setRefreshToken,
      onAuthFailure: () => {
        clearAuthTokens();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          const next = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.replace(`/login?next=${next}`);
        }
      },
    });
  }
  return sharedClient;
}
