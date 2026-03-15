import React from "react";
import { Button, EmptyState, ErrorState, LoadingSkeleton, TextField } from "@nimbus/ui-kit";
import type { Job } from "../api/jobs";
import type { Volume } from "../api/volumes";
import { getLocale, t, type I18nKey } from "../i18n/t";
import { JobDetailsCard } from "./JobDetailsCard";

type ValidateResult = {
  ok: boolean;
  writable: boolean;
  free_bytes: number;
  total_bytes: number;
  fs_type?: string;
  message?: string;
};

type ActiveVolumeSectionProps = {
  loading: boolean;
  activeVolume: Volume | undefined;
  statusKeyMap: Record<Volume["status"], I18nKey>;
  scanStatusKeyMap: Record<"queued" | "running" | "succeeded" | "failed", I18nKey>;
  scanRetrying: boolean;
  onRetryScan: () => void;
};

const formatProgress = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
};

export function ActiveVolumeSection({
  loading,
  activeVolume,
  statusKeyMap,
  scanStatusKeyMap,
  scanRetrying,
  onRetryScan,
}: ActiveVolumeSectionProps) {
  const scanState = activeVolume?.scan_state;
  const scanStateKey = scanState ? scanStatusKeyMap[scanState] : null;
  const showRetry = scanState === "failed";

  return (
    <section className="admin-storage__section">
      <h2 className="admin-storage__section-title">{t("admin.storage.activeTitle")}</h2>
      {loading ? (
        <LoadingSkeleton lines={2} />
      ) : activeVolume ? (
        <div className="admin-storage__stack">
          <strong>{activeVolume.name}</strong>
          <p className="admin-storage__muted">{activeVolume.base_path}</p>
          <p className="admin-storage__muted">{t(statusKeyMap[activeVolume.status])}</p>
          <p className="admin-storage__muted">
            {t("field.jobStatus")}: {scanStateKey ? t(scanStateKey) : "-"}
          </p>
          <p className="admin-storage__muted">
            {t("field.jobProgress")}: {formatProgress(activeVolume.scan_progress)}
          </p>
          {activeVolume.scan_error ? <p className="admin-storage__muted">{activeVolume.scan_error}</p> : null}
          {showRetry ? (
            <div className="admin-storage__actions">
              <Button variant="secondary" onClick={onRetryScan} loading={scanRetrying}>
                {t("action.retry")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="admin-storage__muted">{t("msg.noActiveVolume")}</p>
      )}
    </section>
  );
}

type ValidatePathSectionProps = {
  validatePath: string;
  validating: boolean;
  validateErrorKey: I18nKey | null;
  validateResult: ValidateResult | null;
  setValidatePath: (value: string) => void;
  onValidate: () => void;
  formatBytes: (value?: number) => string;
};

export function ValidatePathSection({
  validatePath,
  validating,
  validateErrorKey,
  validateResult,
  setValidatePath,
  onValidate,
  formatBytes,
}: ValidatePathSectionProps) {
  return (
    <section className="admin-storage__section">
      <h2 className="admin-storage__section-title">{t("modal.storageValidate.title")}</h2>
      <TextField
        label={t("field.path")}
        value={validatePath}
        onChange={(event) => setValidatePath(event.currentTarget.value)}
        placeholder="/mnt/storage"
      />
      <div className="admin-storage__actions">
        <Button variant="primary" onClick={onValidate} disabled={!validatePath || validating} loading={validating}>
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
            <p className="admin-storage__muted">
              {t("field.fileSystem")}: {validateResult.fs_type}
            </p>
          ) : null}
          {validateResult.message ? <p className="admin-storage__muted">{validateResult.message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

type CreateVolumeSectionProps = {
  createName: string;
  createPath: string;
  creating: boolean;
  createErrorKey: I18nKey | null;
  created: boolean;
  setCreateName: (value: string) => void;
  setCreatePath: (value: string) => void;
  onCreate: () => void;
};

export function CreateVolumeSection({
  createName,
  createPath,
  creating,
  createErrorKey,
  created,
  setCreateName,
  setCreatePath,
  onCreate,
}: CreateVolumeSectionProps) {
  return (
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
        <Button variant="primary" onClick={onCreate} disabled={!createName || !createPath || creating} loading={creating}>
          {t("action.createVolume")}
        </Button>
      </div>
    </section>
  );
}

type ActivateVolumeSectionProps = {
  selectedVolume: Volume | null;
  activateErrorKey: I18nKey | null;
  activated: boolean;
  deactivated: boolean;
  deleted: boolean;
  activating: boolean;
  deactivating: boolean;
  deleting: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
};

export function ActivateVolumeSection({
  selectedVolume,
  activateErrorKey,
  activated,
  deactivated,
  deleted,
  activating,
  deactivating,
  deleting,
  onActivate,
  onDeactivate,
  onDelete,
}: ActivateVolumeSectionProps) {
  const locale = getLocale();
  const deactivateLabel = locale === "en-US" ? "Deactivate" : "비활성화";
  const deactivatedMessage = locale === "en-US" ? "Volume deactivated." : "볼륨을 비활성화했습니다.";
  const deletedMessage = locale === "en-US" ? "Volume deleted." : "볼륨을 삭제했습니다.";

  return (
    <section className="admin-storage__section">
      <h2 className="admin-storage__section-title">{t("admin.storage.activateTitle")}</h2>
      <p className="admin-storage__muted">
        {selectedVolume ? `${t("msg.selectedVolume")}: ${selectedVolume.name}` : t("msg.noVolumeSelected")}
      </p>
      {activateErrorKey ? <ErrorState title={t(activateErrorKey)} /> : null}
      {activated ? <p className="admin-storage__muted">{t("msg.volumeActivated")}</p> : null}
      {deactivated ? <p className="admin-storage__muted">{deactivatedMessage}</p> : null}
      {deleted ? <p className="admin-storage__muted">{deletedMessage}</p> : null}
      <div className="admin-storage__actions">
        <Button
          variant="primary"
          onClick={onActivate}
          disabled={!selectedVolume || selectedVolume.is_active}
          loading={activating}
        >
          {t("action.activateVolume")}
        </Button>
        <Button
          variant="secondary"
          onClick={onDeactivate}
          disabled={!selectedVolume || !selectedVolume.is_active}
          loading={deactivating}
        >
          {deactivateLabel}
        </Button>
        <Button
          variant="ghost"
          onClick={onDelete}
          disabled={!selectedVolume || selectedVolume.is_active}
          loading={deleting}
        >
          {t("action.delete")}
        </Button>
      </div>
    </section>
  );
}

type ScanCleanupSectionProps = {
  scanDeleteFiles: boolean;
  scanDeleteRows: boolean;
  scanSubmitting: boolean;
  scanErrorKey: I18nKey | null;
  scanJobLoading: boolean;
  scanJobErrorKey: I18nKey | null;
  scanJob: Job | null;
  onToggleDeleteFiles: (checked: boolean) => void;
  onToggleDeleteRows: (checked: boolean) => void;
  onStartScan: () => void;
  onRefreshJob: (jobId: string) => void;
};

export function ScanCleanupSection({
  scanDeleteFiles,
  scanDeleteRows,
  scanSubmitting,
  scanErrorKey,
  scanJobLoading,
  scanJobErrorKey,
  scanJob,
  onToggleDeleteFiles,
  onToggleDeleteRows,
  onStartScan,
  onRefreshJob,
}: ScanCleanupSectionProps) {
  return (
    <section className="admin-storage__section">
      <h2 className="admin-storage__section-title">{t("modal.cleanup.title")}</h2>
      <div className="admin-storage__checkboxes">
        <label className="admin-storage__checkbox">
          <input
            type="checkbox"
            checked={scanDeleteFiles}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onToggleDeleteFiles(event.target.checked)}
          />
          <span>{t("field.deleteOrphanFiles")}</span>
        </label>
        <label className="admin-storage__checkbox">
          <input
            type="checkbox"
            checked={scanDeleteRows}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => onToggleDeleteRows(event.target.checked)}
          />
          <span>{t("field.deleteOrphanDbRows")}</span>
        </label>
      </div>

      {scanErrorKey ? <ErrorState title={t(scanErrorKey)} /> : null}
      <div className="admin-storage__actions">
        <Button variant="primary" onClick={onStartScan} disabled={scanSubmitting} loading={scanSubmitting}>
          {t("action.startScan")}
        </Button>
      </div>

      {scanJobLoading ? <LoadingSkeleton lines={3} /> : null}
      {scanJobErrorKey ? <ErrorState title={t(scanJobErrorKey)} /> : null}
      {scanJob ? (
        <JobDetailsCard
          job={scanJob}
          titleKey="admin.jobs.title"
          onRefresh={() => onRefreshJob(scanJob.id)}
          loading={scanJobLoading}
          errorKey={scanJobErrorKey}
        />
      ) : (
        <EmptyState title={t("msg.noJobs")} />
      )}
    </section>
  );
}
