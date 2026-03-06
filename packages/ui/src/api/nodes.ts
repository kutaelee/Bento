import { createApiClient } from "./client";
import type { components } from "./schema";

type SuccessResponse = components["schemas"]["SuccessResponse"];

type CreateFolderRequest = components["schemas"]["CreateFolderRequest"];
type RenameRequest = components["schemas"]["RenameRequest"];
type MoveCopyRequest = components["schemas"]["MoveCopyRequest"];
type ShareLinkCreateRequest = components["schemas"]["ShareLinkCreateRequest"];
type ShareLinkCreatePayload = Partial<ShareLinkCreateRequest>;

export type NodeType = components["schemas"]["NodeType"];

export type NodeItem = components["schemas"]["Node"];

export type ListChildrenResponse = components["schemas"]["ListChildrenResponse"];

export type ListTrashResponse = components["schemas"]["ListTrashResponse"];

export type BreadcrumbItem = components["schemas"]["BreadcrumbItem"];

export type BreadcrumbResponse = components["schemas"]["BreadcrumbResponse"];

export type ListChildrenParams = {
  nodeId: string;
  cursor?: string | null;
  limit?: number;
  sort?: "name" | "updated_at" | "size_bytes";
  order?: "asc" | "desc";
};

export type ListTrashParams = {
  cursor?: string | null;
  limit?: number;
};

export type DownloadNodeParams = {
  nodeId: string;
  range?: string;
  signal?: AbortSignal;
};

export type CreateFolderParams = {
  parentId: string;
  name: string;
  idempotencyKey?: string;
};

export type RenameNodeParams = {
  nodeId: string;
  newName: string;
  idempotencyKey?: string;
};

export type JobStatus = components["schemas"]["JobStatus"];

export type Job = components["schemas"]["Job"];

export type MoveNodeParams = {
  nodeId: string;
  destinationParentId: string;
  newName?: string;
  idempotencyKey?: string;
};

export type MoveNodeResponse = NodeItem | Job;

export type CopyNodeParams = {
  nodeId: string;
  destinationParentId: string;
  newName?: string;
  idempotencyKey?: string;
};

export type CopyNodeResponse = NodeItem | Job;

export type RestoreTrashParams = {
  nodeId: string;
  idempotencyKey?: string;
};

export type DeleteTrashParams = {
  nodeId: string;
  idempotencyKey?: string;
};

export type TrashDeleteResponse = SuccessResponse | Job;
export type DeleteNodeResponse = SuccessResponse | Job;

export type ShareLink = components["schemas"]["ShareLink"];

export type SharePermission = ShareLink["permission"];

export type CreateShareLinkParams = {
  nodeId: string;
  expiresInSeconds?: number;
  password?: string;
  permission?: SharePermission;
  idempotencyKey?: string;
};

export const createNodesApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    getNode: async (nodeId: string): Promise<NodeItem> => {
      return client.request<NodeItem>({ path: `/nodes/${nodeId}` });
    },
    getBreadcrumb: async (nodeId: string): Promise<BreadcrumbResponse> => {
      return client.request<BreadcrumbResponse>({ path: `/nodes/${nodeId}/breadcrumb` });
    },
    listChildren: async ({
      nodeId,
      cursor,
      limit = 100,
      sort = "name",
      order = "asc",
    }: ListChildrenParams): Promise<ListChildrenResponse> => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
      if (sort) params.set("sort", sort);
      if (order) params.set("order", order);

      const query = params.toString();
      const suffix = query ? `?${query}` : "";
      return client.request<ListChildrenResponse>({
        path: `/nodes/${nodeId}/children${suffix}`,
      });
    },
    listTrash: async ({ cursor, limit = 100 }: ListTrashParams): Promise<ListTrashResponse> => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));

      const query = params.toString();
      const suffix = query ? `?${query}` : "";
      return client.request<ListTrashResponse>({
        path: `/trash${suffix}`,
      });
    },
    downloadNode: async ({ nodeId, range, signal }: DownloadNodeParams): Promise<Blob> => {
      return client.request<Blob>({
        path: `/nodes/${nodeId}/download`,
        headers: range ? { Range: range } : undefined,
        signal,
        responseType: "blob",
      });
    },
    restoreTrash: async ({ nodeId, idempotencyKey }: RestoreTrashParams): Promise<NodeItem> => {
      return client.request<NodeItem>({
        path: `/trash/${nodeId}/restore`,
        method: "POST",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    deleteTrash: async ({ nodeId, idempotencyKey }: DeleteTrashParams): Promise<TrashDeleteResponse> => {
      return client.request<TrashDeleteResponse>({
        path: `/trash/${nodeId}`,
        method: "DELETE",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    deleteNode: async ({ nodeId, idempotencyKey }: DeleteTrashParams): Promise<DeleteNodeResponse> => {
      return client.request<DeleteNodeResponse>({
        path: `/nodes/${nodeId}`,
        method: "DELETE",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    createShareLink: async ({
      nodeId,
      expiresInSeconds,
      password,
      permission,
      idempotencyKey,
    }: CreateShareLinkParams): Promise<ShareLink> => {
      return client.request<ShareLink>({
        path: `/nodes/${nodeId}/share-links`,
        method: "POST",
        body: {
          ...(expiresInSeconds !== undefined ? { expires_in_seconds: expiresInSeconds } : {}),
          ...(password !== undefined ? { password } : {}),
          ...(permission !== undefined ? { permission } : {}),
        } satisfies ShareLinkCreatePayload,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    deleteShareLink: async ({
      nodeId,
      shareLinkId,
      idempotencyKey,
    }: {
      nodeId: string;
      shareLinkId: string;
      idempotencyKey?: string;
    }): Promise<SuccessResponse> => {
      return client.request<SuccessResponse>({
        path: `/nodes/${nodeId}/share-links/${shareLinkId}`,
        method: "DELETE",
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    createFolder: async ({ parentId, name, idempotencyKey }: CreateFolderParams): Promise<NodeItem> => {
      return client.request<NodeItem>({
        path: `/nodes/folders`,
        method: "POST",
        body: {
          parent_id: parentId,
          name,
        } satisfies CreateFolderRequest,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    renameNode: async ({ nodeId, newName, idempotencyKey }: RenameNodeParams): Promise<NodeItem> => {
      return client.request<NodeItem>({
        path: `/nodes/${nodeId}/rename`,
        method: "POST",
        body: {
          new_name: newName,
        } satisfies RenameRequest,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    moveNode: async ({
      nodeId,
      destinationParentId,
      newName,
      idempotencyKey,
    }: MoveNodeParams): Promise<MoveNodeResponse> => {
      return client.request<MoveNodeResponse>({
        path: `/nodes/${nodeId}/move`,
        method: "POST",
        body: {
          destination_parent_id: destinationParentId,
          ...(newName !== undefined ? { new_name: newName } : {}),
        } satisfies MoveCopyRequest,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
    copyNode: async ({
      nodeId,
      destinationParentId,
      newName,
      idempotencyKey,
    }: CopyNodeParams): Promise<CopyNodeResponse> => {
      return client.request<CopyNodeResponse>({
        path: `/nodes/${nodeId}/copy`,
        method: "POST",
        body: {
          destination_parent_id: destinationParentId,
          ...(newName !== undefined ? { new_name: newName } : {}),
        } satisfies MoveCopyRequest,
        headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
      });
    },
  };
};
