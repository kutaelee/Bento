export type ApiErrorKey =
  | "err.invalidCredentials"
  | "err.unauthorized"
  | "err.forbidden"
  | "err.notFound"
  | "err.conflict"
  | "err.readOnly"
  | "err.uploadFailed"
  | "err.rateLimited"
  | "err.validation"
  | "err.server"
  | "msg.inviteNotFound"
  | "msg.inviteExpired"
  | "msg.inviteAlreadyUsed"
  | "msg.usernameTaken"
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

export const mapErrorCodeToKey = (code: string | null | undefined, status: number): ApiErrorKey => {
  const normalized = String(code || "").trim().toUpperCase();
  switch (normalized) {
    case "INVITE_NOT_FOUND":
      return "msg.inviteNotFound";
    case "INVITE_EXPIRED":
      return "msg.inviteExpired";
    case "INVITE_ALREADY_USED":
      return "msg.inviteAlreadyUsed";
    case "USERNAME_TAKEN":
      return "msg.usernameTaken";
    case "READ_ONLY":
      return "err.readOnly";
    case "UPLOAD_INCOMPLETE":
    case "CHUNK_CONFLICT":
    case "CHECKSUM_MISMATCH":
      return "err.uploadFailed";
    case "NODE_NAME_CONFLICT":
    case "CONFLICT":
      return "err.conflict";
    default:
      return mapStatusToErrorKey(status);
  }
};

export class ApiError extends Error {
  readonly status: number;
  readonly key: ApiErrorKey;
  readonly code?: string;

  constructor(status: number, key: ApiErrorKey, message?: string, code?: string) {
    super(message ?? key);
    this.name = "ApiError";
    this.status = status;
    this.key = key;
    this.code = code;
  }
}
