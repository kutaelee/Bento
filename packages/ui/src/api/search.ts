import { createApiClient } from "./client";
import type { components } from "./schema";
import type { NodeType } from "./nodes";

export type SearchResponse = components["schemas"]["SearchResponse"];

export type SearchParams = {
  query: string;
  cursor?: string | null;
  limit?: number;
  parentId?: string | null;
  type?: NodeType | null;
  includeMetadata?: boolean;
};

export const createSearchApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    searchNodes: async ({
      query,
      cursor,
      limit = 50,
      parentId,
      type,
      includeMetadata = false,
    }: SearchParams): Promise<SearchResponse> => {
      const params = new URLSearchParams();
      params.set("q", query);
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
      if (parentId !== undefined && parentId !== null) {
        params.set("parent_id", parentId);
      }
      if (type !== undefined && type !== null) {
        params.set("type", type);
      }
      if (includeMetadata) {
        params.set("include_metadata", "true");
      }
      return client.request<SearchResponse>({
        path: `/search?${params.toString()}`,
      });
    },
  };
};
