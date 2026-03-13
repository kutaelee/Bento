import { createApiClient } from "../api/client";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from "./authTokens";
import { getAppBasePath, withBasePath } from "./basePath";

let sharedClient: ReturnType<typeof createApiClient> | null = null;

export function getAuthenticatedApiClient() {
  if (!sharedClient) {
    const basePath = getAppBasePath();
    sharedClient = createApiClient({
      baseUrl: basePath,
      getToken: getAccessToken,
      setToken: setAccessToken,
      getRefreshToken: getRefreshToken,
      setRefreshToken: setRefreshToken,
      onAuthFailure: () => {
        clearAuthTokens();
        if (typeof window !== "undefined") {
          const loginPath = withBasePath("/login");
          if (window.location.pathname !== loginPath) {
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.replace(`${loginPath}?next=${next}`);
          }
        }
      },
    });
  }
  return sharedClient;
}
