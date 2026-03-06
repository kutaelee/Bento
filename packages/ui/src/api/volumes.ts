import { createApiClient } from "./client";
import type { components } from "./schema";

export type VolumeScanState = "queued" | "running" | "succeeded" | "failed";
export type Volume = components["schemas"]["Volume"] & {
  scan_state?: VolumeScanState;
  scan_job_id?: string | null;
  scan_progress?: number | null;
  scan_error?: string | null;
  scan_updated_at?: string | null;
};
export type ListVolumesResponse = components["schemas"]["ListVolumesResponse"];
export type CreateVolumeRequest = components["schemas"]["CreateVolumeRequest"];
export type ValidatePathRequest = components["schemas"]["ValidatePathRequest"];
export type ValidatePathResponse = components["schemas"]["ValidatePathResponse"];
export type ScanVolumeRequest = {
  dry_run?: boolean;
};

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
    scanVolume: async (volumeId: string, payload?: ScanVolumeRequest) => {
      return client.request<components["schemas"]["Job"]>({
        path: `/admin/volumes/${volumeId}/scan`,
        method: "POST",
        body: payload && Object.keys(payload).length > 0 ? payload : undefined,
      });
    },
  };
};
