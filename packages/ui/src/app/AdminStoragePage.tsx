import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DataTable, SkeletonBlock, EmptyState, ErrorState, ForbiddenState, PageHeader, Toolbar } from "@nimbus/ui-kit";
import { createAdminMaintenanceApi } from "../api/adminMaintenance";
import { ApiError } from "../api/errors";
import { createJobsApi, type Job } from "../api/jobs";
import { createVolumesApi, type Volume } from "../api/volumes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import {
  ActivateVolumeSection,
  ActiveVolumeSection,
  CreateVolumeSection,
  ScanCleanupSection,
  ValidatePathSection,
} from "./AdminStorageSections";
import "./AdminStoragePage.css";

const statusKeyMap: Record<Volume["status"], I18nKey> = {
  OK: "status.volumeOk",
  DEGRADED: "status.volumeDegraded",
  OFFLINE: "status.volumeOffline",
};

const formatBytes = (value?: number) => {
  if (value === null || value === undefined) return "-";
  if (value === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let idx = 0;
  let size = value;

  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }

  return `${size.toFixed(size < 10 && idx > 0 ? 1 : 0)} ${units[idx]}`;
};

export default function AdminStoragePage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const maintenanceApi = useMemo(() => createAdminMaintenanceApi(apiClient), [apiClient]);
  const jobsApi = useMemo(() => createJobsApi(apiClient), [apiClient]);
  const volumesApi = useMemo(() => createVolumesApi(apiClient), [apiClient]);

  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErrorKey, setLoadErrorKey] = useState<I18nKey | null>(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);

  const [validatePath, setValidatePath] = useState("");
  const [validateResult, setValidateResult] = useState<
    | {
        ok: boolean;
        writable: boolean;
        free_bytes: number;
        total_bytes: number;
        fs_type?: string;
        message?: string;
      }
    | null
  >(null);
  const [validateErrorKey, setValidateErrorKey] = useState<I18nKey | null>(null);
  const [validating, setValidating] = useState(false);

  const [createName, setCreateName] = useState("");
  const [createPath, setCreatePath] = useState("");
  const [createErrorKey, setCreateErrorKey] = useState<I18nKey | null>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const [activateErrorKey, setActivateErrorKey] = useState<I18nKey | null>(null);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);

  const [scanDeleteFiles, setScanDeleteFiles] = useState(false);
  const [scanDeleteRows, setScanDeleteRows] = useState(false);
  const [scanSubmitting, setScanSubmitting] = useState(false);
  const [scanErrorKey, setScanErrorKey] = useState<I18nKey | null>(null);
  const [scanJob, setScanJob] = useState<Job | null>(null);
  const [scanJobLoading, setScanJobLoading] = useState(false);
  const [scanJobErrorKey, setScanJobErrorKey] = useState<I18nKey | null>(null);

  const loadVolumes = useCallback(async () => {
    setLoading(true);
    setLoadErrorKey(null);

    try {
      const response = await volumesApi.listVolumes();
      setVolumes(response.items);
    } catch (error) {
      setLoadErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setLoading(false);
    }
  }, [volumesApi]);

  useEffect(() => {
    void loadVolumes();
  }, [loadVolumes]);

  const activeVolume = volumes.find((volume) => volume.is_active);
  const selectedVolume = useMemo(
    () => volumes.find((volume) => volume.id === selectedVolumeId) ?? null,
    [selectedVolumeId, volumes],
  );

  const handleValidate = async () => {
    if (!validatePath || validating) return;

    setValidating(true);
    setValidateErrorKey(null);
    setValidateResult(null);

    try {
      const result = await volumesApi.validatePath({ base_path: validatePath });
      setValidateResult(result);
    } catch (error) {
      setValidateErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setValidating(false);
    }
  };

  const handleCreate = async () => {
    if (!createName || !createPath || creating) return;

    setCreating(true);
    setCreateErrorKey(null);
    setCreated(false);

    try {
      await volumesApi.createVolume({ name: createName, base_path: createPath });
      setCreateName("");
      setCreatePath("");
      setCreated(true);
      await loadVolumes();
    } catch (error) {
      setCreateErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setCreating(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedVolume || selectedVolume.is_active || activating) return;

    setActivating(true);
    setActivateErrorKey(null);
    setActivated(false);

    try {
      await volumesApi.activateVolume(selectedVolume.id);
      setActivated(true);
      await loadVolumes();
    } catch (error) {
      setActivateErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setActivating(false);
    }
  };

  const fetchScanJob = async (jobId: string) => {
    setScanJobLoading(true);
    setScanJobErrorKey(null);

    try {
      const job = await jobsApi.getJob(jobId);
      setScanJob(job);
    } catch (error) {
      setScanJobErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setScanJobLoading(false);
    }
  };

  const handleStartScan = async () => {
    if (scanSubmitting) return;

    setScanSubmitting(true);
    setScanErrorKey(null);

    try {
      const payload =
        scanDeleteFiles || scanDeleteRows
          ? {
              delete_orphan_files: scanDeleteFiles,
              delete_orphan_db_rows: scanDeleteRows,
            }
          : undefined;

      const job = await maintenanceApi.scanStorage(payload);
      setScanJob(job);
      await fetchScanJob(job.id);
    } catch (error) {
      setScanErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setScanSubmitting(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "name",
        header: t("field.name"),
        renderCell: (item: Volume) => item.name,
      },
      {
        id: "path",
        header: t("field.path"),
        renderCell: (item: Volume) => item.base_path,
      },
      {
        id: "status",
        header: t("field.status"),
        renderCell: (item: Volume) => t(statusKeyMap[item.status]),
      },
      {
        id: "free",
        header: t("field.freeSpace"),
        align: "right" as const,
        renderCell: (item: Volume) => formatBytes(item.free_bytes),
      },
      {
        id: "total",
        header: t("field.totalSpace"),
        align: "right" as const,
        renderCell: (item: Volume) => formatBytes(item.total_bytes),
      },
      {
        id: "active",
        header: t("field.active"),
        align: "center" as const,
        renderCell: (item: Volume) => (item.is_active ? t("status.active") : "-"),
      },
    ],
    [],
  );

  return (
    <section className="admin-storage">
      <PageHeader
        title={t("admin.storage.title")}
        actions={
          <Toolbar>
            <Button variant="ghost" onClick={loadVolumes} disabled={loading}>
              {t("action.refresh")}
            </Button>
          </Toolbar>
        }
      />

      <ActiveVolumeSection loading={loading} activeVolume={activeVolume} statusKeyMap={statusKeyMap} />

      <div className="admin-storage__section">
        <div className="admin-storage__row">
          <h2 className="admin-storage__section-title">{t("admin.storage.listTitle")}</h2>
          <Button variant="ghost" onClick={loadVolumes} disabled={loading}>
            {t("action.refresh")}
          </Button>
        </div>
        {loadErrorKey === "err.forbidden" ? (
          <ForbiddenState titleKey="err.forbidden" descKey="msg.forbiddenAdmin" actionLabelKey="action.goHome" onAction={() => window.location.href = "/"} />
        ) : loadErrorKey ? (
          <ErrorState titleKey="err.unknown" descKey={loadErrorKey} retryLabelKey="action.retry" onRetry={loadVolumes} />
        ) : loading ? (
          <div className="admin-storage__loading">
            <SkeletonBlock height={44} width="100%" />
            <SkeletonBlock height={44} width="100%" />
            <SkeletonBlock height={44} width="100%" />
          </div>
        ) : volumes.length === 0 ? (
          <EmptyState titleKey="msg.emptyVolumes" />
        ) : (
          <div className="admin-storage__table">
            <DataTable
              items={volumes}
              columns={columns}
              heightPx={280}
              rowHeightPx={44}
              getRowKey={(item) => item.id}
              onRowClick={(item) => setSelectedVolumeId(item.id)}
            />
          </div>
        )}
      </div>

      <ValidatePathSection
        validatePath={validatePath}
        validating={validating}
        validateErrorKey={validateErrorKey}
        validateResult={validateResult}
        setValidatePath={setValidatePath}
        onValidate={handleValidate}
        formatBytes={formatBytes}
      />

      <CreateVolumeSection
        createName={createName}
        createPath={createPath}
        creating={creating}
        createErrorKey={createErrorKey}
        created={created}
        setCreateName={setCreateName}
        setCreatePath={setCreatePath}
        onCreate={handleCreate}
      />

      <ActivateVolumeSection
        selectedVolume={selectedVolume}
        activateErrorKey={activateErrorKey}
        activated={activated}
        activating={activating}
        onActivate={handleActivate}
      />

      <ScanCleanupSection
        scanDeleteFiles={scanDeleteFiles}
        scanDeleteRows={scanDeleteRows}
        scanSubmitting={scanSubmitting}
        scanErrorKey={scanErrorKey}
        scanJobLoading={scanJobLoading}
        scanJobErrorKey={scanJobErrorKey}
        scanJob={scanJob}
        onToggleDeleteFiles={setScanDeleteFiles}
        onToggleDeleteRows={setScanDeleteRows}
        onStartScan={handleStartScan}
        onRefreshJob={(jobId) => void fetchScanJob(jobId)}
      />
    </section>
  );
}
