import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "@nimbus/ui-kit";
import { ApiError } from "../api/errors";
import type { UploadStatus, UploadsApi } from "../api/uploads";
import { createUploadsApi } from "../api/uploads";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { useFolderRefresh } from "./folderRefresh";
import "./UploadQueue.css";

const DEFAULT_CONCURRENCY = 2;

type UploadQueueItem = {
  id: string;
  file: File;
  parentId: string;
  status: UploadStatus;
  uploadedChunks: number;
  totalChunks: number;
  errorKey: I18nKey | null;
  uploadId?: string;
  dedupHit?: boolean;
};

type UploadProgress = {
  status: UploadStatus;
  uploadedChunks: number;
  totalChunks: number;
  uploadId?: string;
  dedupHit?: boolean;
};

export type UploadFileOptions = {
  file: File;
  parentId: string;
  uploadsApi: UploadsApi;
  signal?: AbortSignal;
  onProgress?: (progress: UploadProgress) => void;
};

export class UploadAbortedError extends Error {
  constructor() {
    super("Upload aborted");
    this.name = "UploadAbortedError";
  }
}

const toHex = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const hashSha256 = async (buffer: ArrayBuffer): Promise<string> => {
  if (globalThis.crypto?.subtle?.digest) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return toHex(digest);
  }
  if (typeof process !== "undefined" && process.versions?.node) {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(Buffer.from(buffer)).digest("hex");
  }
  throw new Error("SHA-256 not supported in this environment");
};

const createUploadId = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const resolveStatusKey = (status: UploadStatus): I18nKey => {
  switch (status) {
    case "INIT":
      return "status.jobQueued";
    case "UPLOADING":
      return "status.jobRunning";
    case "MERGING":
      return "status.jobRunning";
    case "COMPLETED":
      return "status.jobDone";
    case "FAILED":
      return "status.jobFailed";
    case "ABORTED":
      return "status.uploadPaused";
    default:
      return "status.jobQueued";
  }
};

export const uploadFile = async ({ file, parentId, uploadsApi, signal, onProgress }: UploadFileOptions) => {
  if (signal?.aborted) throw new UploadAbortedError();

  onProgress?.({ status: "INIT", uploadedChunks: 0, totalChunks: 0 });

  const createResponse = await uploadsApi.createUpload({
    parentId,
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type || null,
    modifiedAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    signal,
  });

  if (signal?.aborted) throw new UploadAbortedError();

  const uploadId = createResponse.upload_id;
  const totalChunks = createResponse.total_chunks;
  const chunkSize = createResponse.chunk_size_bytes;

  if (createResponse.dedup_hit) {
    onProgress?.({
      status: "MERGING",
      uploadedChunks: totalChunks,
      totalChunks,
      uploadId,
      dedupHit: true,
    });
    const completed = await uploadsApi.completeUpload({ uploadId });
    onProgress?.({ status: "COMPLETED", uploadedChunks: totalChunks, totalChunks, uploadId });
    return completed;
  }

  onProgress?.({ status: "UPLOADING", uploadedChunks: 0, totalChunks, uploadId });

  const indices = Array.from({ length: totalChunks }, (_, index) => index);
  let uploadedChunks = 0;

  const queue = [...indices];

  const worker = async () => {
    while (queue.length > 0) {
      if (signal?.aborted) throw new UploadAbortedError();
      const index = queue.shift();
      if (index === undefined) return;

      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);
      const buffer = await chunk.arrayBuffer();
      const chunkHash = await hashSha256(buffer);

      await uploadsApi.uploadChunk({
        uploadId,
        chunkIndex: index,
        chunk,
        chunkHash,
        signal,
      });

      uploadedChunks += 1;
      onProgress?.({ status: "UPLOADING", uploadedChunks, totalChunks, uploadId });
    }
  };

  const concurrency = Math.max(1, DEFAULT_CONCURRENCY);
  const workers = Array.from({ length: Math.min(concurrency, totalChunks) }, () => worker());
  await Promise.all(workers);

  if (signal?.aborted) throw new UploadAbortedError();

  onProgress?.({ status: "MERGING", uploadedChunks: totalChunks, totalChunks, uploadId });
  const completed = await uploadsApi.completeUpload({ uploadId });
  onProgress?.({ status: "COMPLETED", uploadedChunks: totalChunks, totalChunks, uploadId });
  return completed;
};

type UploadQueueContextValue = {
  items: UploadQueueItem[];
  enqueueFiles: (files: File[], parentId: string) => void;
  retryUpload: (id: string) => void;
  cancelUpload: (id: string) => void;
};

const UploadQueueContext = createContext<UploadQueueContextValue | null>(null);

type UploadQueueProviderProps = {
  children: React.ReactNode;
};

export function UploadQueueProvider({ children }: UploadQueueProviderProps) {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const uploadsApi = useMemo(() => createUploadsApi({ client: apiClient }), [apiClient]);
  const { triggerRefresh } = useFolderRefresh();

  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const itemsRef = useRef<UploadQueueItem[]>([]);
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  itemsRef.current = items;

  const updateItem = useCallback((id: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const startUpload = useCallback(
    async (item: UploadQueueItem) => {
      const controller = new AbortController();
      controllersRef.current.set(item.id, controller);

      updateItem(item.id, (prev) => ({
        ...prev,
        status: "INIT",
        uploadedChunks: 0,
        totalChunks: 0,
        errorKey: null,
      }));

      try {
        const completed = await uploadFile({
          file: item.file,
          parentId: item.parentId,
          uploadsApi,
          signal: controller.signal,
          onProgress: (progress) => {
            updateItem(item.id, (prev) => ({
              ...prev,
              status: progress.status,
              uploadedChunks: progress.uploadedChunks,
              totalChunks: progress.totalChunks,
              uploadId: progress.uploadId ?? prev.uploadId,
              dedupHit: progress.dedupHit ?? prev.dedupHit,
            }));
          },
        });

        updateItem(item.id, (prev) => ({
          ...prev,
          status: "COMPLETED",
          uploadedChunks: prev.totalChunks,
          errorKey: null,
          uploadId: prev.uploadId ?? completed.node_id,
        }));
        triggerRefresh();
      } catch (error) {
        if (error instanceof UploadAbortedError || controller.signal.aborted) {
          updateItem(item.id, (prev) => ({
            ...prev,
            status: "ABORTED",
          }));
          return;
        }
        if (error instanceof ApiError) {
          updateItem(item.id, (prev) => ({
            ...prev,
            status: "FAILED",
            errorKey: error.key,
          }));
          return;
        }
        updateItem(item.id, (prev) => ({
          ...prev,
          status: "FAILED",
          errorKey: "err.unknown",
        }));
      } finally {
        controllersRef.current.delete(item.id);
      }
    },
    [triggerRefresh, updateItem, uploadsApi],
  );

  const enqueueFiles = useCallback(
    (files: File[], parentId: string) => {
      if (!files.length) return;
      const newItems = files.map((file) => ({
        id: createUploadId(),
        file,
        parentId,
        status: "INIT" as UploadStatus,
        uploadedChunks: 0,
        totalChunks: 0,
        errorKey: null,
      }));

      setItems((prev) => [...prev, ...newItems]);

      queueMicrotask(() => {
        newItems.forEach((entry) => {
          void startUpload(entry);
        });
      });
    },
    [startUpload],
  );

  const cancelUpload = useCallback(
    (id: string) => {
      const controller = controllersRef.current.get(id);
      if (controller) {
        controller.abort();
      }

      const item = itemsRef.current.find((entry) => entry.id === id);
      if (item?.uploadId) {
        void uploadsApi.abortUpload({ uploadId: item.uploadId });
      }

      updateItem(id, (prev) => ({
        ...prev,
        status: "ABORTED",
      }));
    },
    [triggerRefresh, updateItem, uploadsApi],
  );

  const retryUpload = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((entry) => entry.id === id);
      if (!item) return;

      const resetItem: UploadQueueItem = {
        ...item,
        status: "INIT",
        uploadedChunks: 0,
        totalChunks: 0,
        errorKey: null,
        uploadId: undefined,
        dedupHit: undefined,
      };

      updateItem(id, () => resetItem);
      void startUpload(resetItem);
    },
    [startUpload, updateItem],
  );

  const value = useMemo(
    () => ({ items, enqueueFiles, retryUpload, cancelUpload }),
    [items, enqueueFiles, retryUpload, cancelUpload],
  );

  return <UploadQueueContext.Provider value={value}>{children}</UploadQueueContext.Provider>;
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext);
  if (!context) {
    throw new Error("useUploadQueue must be used within UploadQueueProvider");
  }
  return context;
}

const formatBytes = (value: number) => {
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

export function UploadQueuePanel() {
  const { items, retryUpload, cancelUpload } = useUploadQueue();

  if (!items.length) return null;

  return (
    <section className="upload-queue">
      <div className="upload-queue__header">{t("action.upload")}</div>
      <div className="upload-queue__list">
        {items.map((item) => {
          const progress = item.totalChunks
            ? Math.round((item.uploadedChunks / item.totalChunks) * 100)
            : 0;
          const statusKey = resolveStatusKey(item.status);
          return (
            <div key={item.id} className="upload-queue__item">
              <div className="upload-queue__filename">{item.file.name}</div>
              <div className="upload-queue__meta">
                <span>{formatBytes(item.file.size)}</span>
                <span>
                  {t(statusKey)} • {item.uploadedChunks}/{item.totalChunks || "-"}
                </span>
              </div>
              <progress className="upload-queue__progress" value={progress} max={100} />
              {item.errorKey ? <div className="upload-queue__error">{t(item.errorKey)}</div> : null}
              <div className="upload-queue__actions">
                {item.status === "FAILED" ? (
                  <Button type="button" variant="secondary" onClick={() => retryUpload(item.id)}>
                    {t("action.retry")}
                  </Button>
                ) : null}
                {item.status === "UPLOADING" || item.status === "MERGING" || item.status === "INIT" ? (
                  <Button type="button" variant="secondary" onClick={() => cancelUpload(item.id)}>
                    {t("action.cancel")}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
