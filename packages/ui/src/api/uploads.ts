import { createApiClient } from "./client";
import type { components } from "./schema";

export type UploadStatus = components["schemas"]["UploadStatus"];

export type CreateUploadRequest = components["schemas"]["CreateUploadRequest"];

export type CreateUploadResponse = components["schemas"]["CreateUploadResponse"];

export type UploadSession = components["schemas"]["UploadSession"];

export type CompleteUploadResponse = components["schemas"]["CompleteUploadResponse"];

export type SuccessResponse = components["schemas"]["SuccessResponse"];

export type CreateUploadParams = {
  parentId: string;
  filename: string;
  sizeBytes: number;
  sha256?: string;
  mimeType?: string | null;
  modifiedAt?: string | null;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type UploadChunkParams = {
  uploadId: string;
  chunkIndex: number;
  chunk: Blob;
  chunkHash: string;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

export type CompleteUploadParams = {
  uploadId: string;
  idempotencyKey?: string;
};

export type AbortUploadParams = {
  uploadId: string;
  idempotencyKey?: string;
};

export type UploadsApiOptions = {
  client: ReturnType<typeof createApiClient>;
};

export type UploadsApi = ReturnType<typeof createUploadsApi>;

export const createUploadsApi = ({ client }: UploadsApiOptions) => {
  return {
    createUpload: async ({
      parentId,
      filename,
      sizeBytes,
      sha256,
      mimeType,
      modifiedAt,
      idempotencyKey,
      signal,
    }: CreateUploadParams): Promise<CreateUploadResponse> => {
      return client.request<CreateUploadResponse>({
        path: "/uploads",
        method: "POST",
        body: {
          parent_id: parentId,
          filename,
          size_bytes: sizeBytes,
          ...(sha256 ? { sha256 } : {}),
          ...(mimeType !== undefined ? { mime_type: mimeType } : {}),
          ...(modifiedAt !== undefined ? { modified_at: modifiedAt } : {}),
        } satisfies CreateUploadRequest,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
        signal,
      });
    },
    uploadChunk: async ({
      uploadId,
      chunkIndex,
      chunk,
      chunkHash,
      idempotencyKey,
      signal,
    }: UploadChunkParams): Promise<UploadSession> => {
      return client.request<UploadSession>({
        path: `/uploads/${uploadId}/chunks/${chunkIndex}`,
        method: "PUT",
        rawBody: chunk,
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Chunk-SHA256": chunkHash,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        signal,
      });
    },
    completeUpload: async ({ uploadId, idempotencyKey }: CompleteUploadParams): Promise<CompleteUploadResponse> => {
      return client.request<CompleteUploadResponse>({
        path: `/uploads/${uploadId}/complete`,
        method: "POST",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    abortUpload: async ({ uploadId, idempotencyKey }: AbortUploadParams): Promise<SuccessResponse> => {
      return client.request<SuccessResponse>({
        path: `/uploads/${uploadId}`,
        method: "DELETE",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
  };
};
