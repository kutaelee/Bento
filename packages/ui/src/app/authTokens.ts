import type { StoredAuthTokens } from "../api/auth";

const safeStorage = () => (typeof window === "undefined" ? null : window.localStorage);

export const saveAuthTokens = (tokens: StoredAuthTokens) => {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem("nd.access_token", tokens.access_token);
  storage.setItem("nd.refresh_token", tokens.refresh_token);
  storage.setItem("nd.token_type", tokens.token_type);
  storage.setItem("nd.expires_in_seconds", tokens.expires_in_seconds.toString());
};

export const getAccessToken = () => {
  const storage = safeStorage();
  return storage?.getItem("nd.access_token") ?? null;
};

export const getRefreshToken = () => {
  const storage = safeStorage();
  return storage?.getItem("nd.refresh_token") ?? null;
};

export const setAccessToken = (token: string | null) => {
  const storage = safeStorage();
  if (!storage) return;
  if (token) {
    storage.setItem("nd.access_token", token);
  } else {
    storage.removeItem("nd.access_token");
  }
};

export const setRefreshToken = (token: string | null) => {
  const storage = safeStorage();
  if (!storage) return;
  if (token) {
    storage.setItem("nd.refresh_token", token);
  } else {
    storage.removeItem("nd.refresh_token");
  }
};

export const clearAuthTokens = () => {
  const storage = safeStorage();
  if (!storage) return;
  storage.removeItem("nd.access_token");
  storage.removeItem("nd.refresh_token");
  storage.removeItem("nd.token_type");
  storage.removeItem("nd.expires_in_seconds");
};
