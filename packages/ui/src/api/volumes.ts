import { createApiClient } from "./client";
import type { components } from "./schema";

export type Volume = components["schemas"]["Volume"];
export type ListVolumesResponse = components["schemas"]["ListVolumesResponse"];
export type CreateVolumeRequest = components["schemas"]["CreateVolumeRequest"];
export type ValidatePathRequest = components["schemas"]["ValidatePathRequest"];
export type ValidatePathResponse = components["schemas"]["ValidatePathResponse"];

export const createVolumesApi = (client: ReturnType<typeof createApiClient>) => {
  return {
    listVolumes: async (): Promise<ListVolumesResponse> => {
      return client.request<ListVolumesResponse>({ path: "/admin/volumes" });
    },
    createVolume: async (payload: CreateVolumeRequest): Promise<Volume> => {
      return client.request<Volume>({
        path: "/admin/volumes",
        method: "POST",
        body: payload,
      });
    },
    validatePath: async (payload: ValidatePathRequest): Promise<ValidatePathResponse> => {
      return client.request<ValidatePathResponse>({
        path: "/admin/volumes/validate-path",
        method: "POST",
        body: payload,
      });
    },
    activateVolume: async (volumeId: string): Promise<Volume> => {
      return client.request<Volume>({
        path: `/admin/volumes/${volumeId}/activate`,
        method: "POST",
      });
    },
  };
};
