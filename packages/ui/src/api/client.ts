import { ApiError, ApiErrorKey, mapStatusToErrorKey } from "./errors";
import type { components } from "./schema";

export type ApiClientOptions = {
  baseUrl: string;

  getToken?: () => string | null;
  setToken?: (token: string | null) => void;

  getRefreshToken?: () => string | null;
  setRefreshToken?: (token: string | null) => void;

  /**
   * Called when auth is no longer valid (e.g. refresh failed).
   * Use this to clear local state and redirect to /login.
   */
  onAuthFailure?: () => void;

  getLocale?: () => "ko-KR" | "en-US";
};

export type ApiRequest = {
  path: string;
  method?: string;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  responseType?: "json" | "text" | "blob";
};

const defaultLocale = "ko-KR" as const;

type RefreshResponse = components["schemas"]["AuthTokens"];

export const createApiClient = (options: ApiClientOptions) => {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  let refreshInFlight: Promise<string | null> | null = null;

  const rawRequest = async <T = unknown>(
    req: ApiRequest,
  ): Promise<T> => {
    const url = `${baseUrl}${req.path}`;
    const locale = options.getLocale?.() ?? defaultLocale;
    const token = options.getToken?.();
    const hasRawBody = req.rawBody !== undefined;
    const hasJsonBody = req.body !== undefined;

    const headers: Record<string, string> = {
      "Accept-Language": locale,
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...req.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const body = hasRawBody
      ? req.rawBody
      : hasJsonBody
        ? JSON.stringify(req.body)
        : undefined;

    const response = await fetch(url, {
      method: req.method ?? "GET",
      headers,
      body,
      signal: req.signal,
    });

    if (!response.ok) {
      const key: ApiErrorKey = mapStatusToErrorKey(response.status);
      throw new ApiError(response.status, key);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const responseType = req.responseType ?? "auto";

    if (responseType === "blob") {
      return (await response.blob()) as T;
    }

    const text = await response.text();

    if (!text) {
      return undefined as T;
    }

    if (responseType === "text") {
      return text as T;
    }

    if (responseType === "json") {
      return JSON.parse(text) as T;
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return JSON.parse(text) as T;
    }

    return text as T;
  };

  const tryRefresh = async (): Promise<string | null> => {
    if (refreshInFlight) {
      return refreshInFlight;
    }

    const runRefresh = async () => {
      const refreshToken = options.getRefreshToken?.() ?? null;
      if (!refreshToken) return null;

      const url = `${baseUrl}/auth/refresh`;
      const locale = options.getLocale?.() ?? defaultLocale;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Accept-Language": locale,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const json = (await response.json()) as RefreshResponse;

      const nextAccess = typeof json.access_token === "string" ? json.access_token : null;
      const nextRefresh = typeof json.refresh_token === "string" ? json.refresh_token : null;

      if (nextAccess) options.setToken?.(nextAccess);
      if (nextRefresh) options.setRefreshToken?.(nextRefresh);

      return nextAccess;
    };

    const inFlight = runRefresh();
    refreshInFlight = inFlight;
    try {
      return await inFlight;
    } finally {
      if (refreshInFlight === inFlight) {
        refreshInFlight = null;
      }
    }
  };

  const request = async <T = unknown>(req: ApiRequest): Promise<T> => {
    try {
      return await rawRequest<T>(req);
    } catch (err) {
      if (!(err instanceof ApiError)) throw err;

      // Infinite loop prevention: only refresh once, and never refresh on refresh/logout calls.
      const isUnauthorized = err.status === 401;
      const isAuthCall = req.path === "/auth/refresh" || req.path === "/auth/logout";

      if (!isUnauthorized || isAuthCall) {
        throw err;
      }

      const nextToken = await tryRefresh();
      if (!nextToken) {
        options.setToken?.(null);
        options.setRefreshToken?.(null);
        options.onAuthFailure?.();
        throw err;
      }

      // Retry original request once with new token.
      return rawRequest<T>(req);
    }
  };

  return { request };
};
