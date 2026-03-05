import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DataTable, TextField, SkeletonBlock, EmptyState, ErrorState, ForbiddenState, PageHeader, Toolbar, LoadingSkeleton } from "@nimbus/ui-kit";
import { createAdminMaintenanceApi } from "../api/adminMaintenance";
import { ApiError } from "../api/errors";
import { createJobsApi, type Job } from "../api/jobs";
import { createVolumesApi, type Volume } from "../api/volumes";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { JobDetailsCard } from "./JobDetailsCard";
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

      <section className="admin-storage__section">
        <h2 className="admin-storage__section-title">{t("admin.storage.activeTitle")}</h2>
        {loading ? (
          <LoadingSkeleton lines={2} />
        ) : activeVolume ? (
          <div className="admin-storage__stack">
            <strong>{activeVolume.name}</strong>
            <p className="admin-storage__muted">{activeVolume.base_path}</p>
            <p className="admin-storage__muted">{t(statusKeyMap[activeVolume.status])}</p>
          </div>
        ) : (
          <p className="admin-storage__muted">{t("msg.noActiveVolume")}</p>
        )}
      </section>

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

      <section className="admin-storage__section">
        <h2 className="admin-storage__section-title">{t("modal.storageValidate.title")}</h2>
        <TextField
          label={t("field.path")}
          value={validatePath}
          onChange={(event) => setValidatePath(event.currentTarget.value)}
          placeholder="/mnt/storage"
        />
        <div className="admin-storage__actions">
          <Button
            variant="primary"
            onClick={handleValidate}
            disabled={!validatePath || validating}
            loading={validating}
          >
            {t("action.validatePath")}
          </Button>
        </div>
        {validateErrorKey ? <ErrorState title={t(validateErrorKey)} /> : null}
        {validateResult ? (
          <div className="admin-storage__stack">
            <p className="admin-storage__muted">
              {t("status.validation")}: {validateResult.ok ? t("status.ok") : t("status.fail")}
            </p>
            <p className="admin-storage__muted">
              {t("status.writable")}: {validateResult.writable ? t("status.ok") : t("status.fail")}
            </p>
            <p className="admin-storage__muted">
              {t("field.freeSpace")}: {formatBytes(validateResult.free_bytes)}
            </p>
            <p className="admin-storage__muted">
              {t("field.totalSpace")}: {formatBytes(validateResult.total_bytes)}
            </p>
            {validateResult.fs_type ? (
              <p className="admin-storage__muted">{t("field.fileSystem")}: {validateResult.fs_type}</p>
            ) : null}
            {validateResult.message ? <p className="admin-storage__muted">{validateResult.message}</p> : null}
          </div>
        ) : null}
      </section>

      <section className="admin-storage__section">
        <h2 className="admin-storage__section-title">{t("admin.storage.createTitle")}</h2>
        <TextField
          label={t("field.name")}
          value={createName}
          onChange={(event) => setCreateName(event.currentTarget.value)}
          placeholder="Main"
        />
        <TextField
          label={t("field.path")}
          value={createPath}
          onChange={(event) => setCreatePath(event.currentTarget.value)}
          placeholder="/mnt/storage"
        />
        {createErrorKey ? <ErrorState title={t(createErrorKey)} /> : null}
        {created ? <p className="admin-storage__muted">{t("msg.volumeCreated")}</p> : null}
        <div className="admin-storage__actions">
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={!createName || !createPath || creating}
            loading={creating}
          >
            {t("action.createVolume")}
          </Button>
        </div>
      </section>

      <section className="admin-storage__section">
        <h2 className="admin-storage__section-title">{t("admin.storage.activateTitle")}</h2>
        <p className="admin-storage__muted">
          {selectedVolume
            ? `${t("msg.selectedVolume")}: ${selectedVolume.name}`
            : t("msg.noVolumeSelected")}
        </p>
        {activateErrorKey ? <ErrorState title={t(activateErrorKey)} /> : null}
        {activated ? <p className="admin-storage__muted">{t("msg.volumeActivated")}</p> : null}
        <div className="admin-storage__actions">
          <Button
            variant="primary"
            onClick={handleActivate}
            disabled={!selectedVolume || selectedVolume.is_active}
            loading={activating}
          >
            {t("action.activateVolume")}
          </Button>
        </div>
      </section>

      <section className="admin-storage__section">
        <h2 className="admin-storage__section-title">{t("modal.cleanup.title")}</h2>
        <div className="admin-storage__checkboxes">
          <label className="admin-storage__checkbox">
            <input
              type="checkbox"
              checked={scanDeleteFiles}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setScanDeleteFiles(event.target.checked)
              }
            />
            <span>{t("field.deleteOrphanFiles")}</span>
          </label>
          <label className="admin-storage__checkbox">
            <input
              type="checkbox"
              checked={scanDeleteRows}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setScanDeleteRows(event.target.checked)
              }
            />
            <span>{t("field.deleteOrphanDbRows")}</span>
          </label>
        </div>

        {scanErrorKey ? <ErrorState title={t(scanErrorKey)} /> : null}
        <div className="admin-storage__actions">
          <Button
            variant="primary"
            onClick={handleStartScan}
            disabled={scanSubmitting}
            loading={scanSubmitting}
          >
            {t("action.startScan")}
          </Button>
        </div>

        {scanJobLoading ? <LoadingSkeleton lines={3} /> : null}
        {scanJobErrorKey ? <ErrorState title={t(scanJobErrorKey)} /> : null}
        {scanJob ? (
          <JobDetailsCard
            job={scanJob}
            titleKey="admin.jobs.title"
            onRefresh={() => void fetchScanJob(scanJob.id)}
            loading={scanJobLoading}
            errorKey={scanJobErrorKey}
          />
        ) : (
          <p className="admin-storage__muted">{t("msg.noJobs")}</p>
        )}
      </section>
    </section>
  );
}
