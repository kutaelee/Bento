export type ApiErrorKey =
  | "err.unauthorized"
  | "err.forbidden"
  | "err.notFound"
  | "err.conflict"
  | "err.rateLimited"
  | "err.validation"
  | "err.server"
  | "err.unknown";

export const mapStatusToErrorKey = (status: number): ApiErrorKey => {
  switch (status) {
    case 400:
      return "err.validation";
    case 401:
      return "err.unauthorized";
    case 403:
      return "err.forbidden";
    case 404:
      return "err.notFound";
    case 409:
      return "err.conflict";
    case 429:
      return "err.rateLimited";
    case 500:
      return "err.server";
    default:
      return "err.unknown";
  }
};

export class ApiError extends Error {
  readonly status: number;
  readonly key: ApiErrorKey;

  constructor(status: number, key: ApiErrorKey, message?: string) {
    super(message ?? key);
    this.name = "ApiError";
    this.status = status;
    this.key = key;
  }
}
