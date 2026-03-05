import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, TextField, SkeletonBlock, LoadingSkeleton, ErrorState, ForbiddenState, EmptyState } from "@nimbus/ui-kit";
import { createAdminMaintenanceApi } from "../api/adminMaintenance";
import { ApiError } from "../api/errors";
import { createJobsApi, type Job } from "../api/jobs";
import { createSystemModeApi } from "../api/systemMode";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { JobDetailsCard } from "./JobDetailsCard";
import "./AdminMigrationPage.css";

export default function AdminMigrationPage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const maintenanceApi = useMemo(() => createAdminMaintenanceApi(apiClient), [apiClient]);
  const jobsApi = useMemo(() => createJobsApi(apiClient), [apiClient]);
  const systemModeApi = useMemo(() => createSystemModeApi(apiClient), [apiClient]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [initialReadOnly, setInitialReadOnly] = useState(false);
  const [loadErrorKey, setLoadErrorKey] = useState<I18nKey | null>(null);
  const [submitErrorKey, setSubmitErrorKey] = useState<I18nKey | null>(null);
  const [saved, setSaved] = useState(false);

  const [targetVolumeId, setTargetVolumeId] = useState("");
  const [verifySha256, setVerifySha256] = useState(true);
  const [deleteSourceAfter, setDeleteSourceAfter] = useState(false);
  const [migrationSubmitting, setMigrationSubmitting] = useState(false);
  const [migrationErrorKey, setMigrationErrorKey] = useState<I18nKey | null>(null);
  const [migrationJob, setMigrationJob] = useState<Job | null>(null);
  const [migrationJobLoading, setMigrationJobLoading] = useState(false);
  const [migrationJobErrorKey, setMigrationJobErrorKey] = useState<I18nKey | null>(null);

  const loadStatus = useCallback(async () => {
    if (submitting) return;

    setLoading(true);
    setLoadErrorKey(null);

    try {
      const status = await systemModeApi.getStatus();
      setReadOnly(Boolean(status.read_only));
      setInitialReadOnly(Boolean(status.read_only));
      setLoading(false);
    } catch (error) {
      setLoadErrorKey(error instanceof ApiError ? error.key : "err.network");
      setLoading(false);
    }
  }, [systemModeApi, submitting]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) return;
      await loadStatus();
    };

    void run();

    return () => {
      active = false;
    };
  }, [loadStatus]);

  const isDirty = readOnly !== initialReadOnly;

  const fetchMigrationJob = async (jobId: string) => {
    setMigrationJobLoading(true);
    setMigrationJobErrorKey(null);
    try {
      const job = await jobsApi.getJob(jobId);
      setMigrationJob(job);
    } catch (error) {
      setMigrationJobErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setMigrationJobLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || !isDirty) return;

    setSubmitting(true);
    setSubmitErrorKey(null);
    setSaved(false);

    try {
      const result = await systemModeApi.updateStatus({ read_only: readOnly });
      setInitialReadOnly(Boolean(result.read_only));
      setSaved(true);
    } catch (error) {
      setSubmitErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartMigration = async () => {
    if (!targetVolumeId || migrationSubmitting) return;

    setMigrationSubmitting(true);
    setMigrationErrorKey(null);
    try {
      const job = await maintenanceApi.startMigration({
        target_volume_id: targetVolumeId,
        verify_sha256: verifySha256,
        delete_source_after: deleteSourceAfter,
      });
      setMigrationJob(job);
      await fetchMigrationJob(job.id);
    } catch (error) {
      setMigrationErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setMigrationSubmitting(false);
    }
  };

  return (
    <section className="admin-migration">
      <h1 className="admin-migration__title">{t("admin.migration.title")}</h1>
      <div className="admin-migration__section">
        {loadErrorKey === "err.forbidden" ? (
          <ForbiddenState titleKey="err.forbidden" descKey="msg.forbiddenAdmin" actionLabelKey="action.goHome" onAction={() => window.location.href = "/"} />
        ) : loadErrorKey ? (
          <ErrorState titleKey="err.unknown" descKey={loadErrorKey} retryLabelKey="action.retry" onRetry={() => window.location.reload()} />
        ) : loading ? (
          <div className="admin-migration__loading">
            <SkeletonBlock height={20} width="40%" />
            <SkeletonBlock height={20} width="80%" />
            <SkeletonBlock height={40} width="100px" className="admin-migration__save-skeleton" />
          </div>
        ) : (
          <>
            <div className="admin-migration__row">
              <label className="admin-migration__checkbox">
                <input
                  type="checkbox"
                  checked={readOnly}
                  disabled={submitting}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setReadOnly(event.target.checked);
                    setSaved(false);
                  }}
                  aria-label={t("status.readOnly")}
                />
                <span>{t("status.readOnly")}</span>
              </label>
            </div>
            <p className="admin-migration__muted">{t("status.migrating")}</p>
            {submitErrorKey ? <p className="admin-migration__alert">{t(submitErrorKey)}</p> : null}
            {saved ? <p className="admin-migration__muted">{t("msg.changesSaved")}</p> : null}
            <div className="admin-migration__actions">
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={!isDirty || submitting}
                loading={submitting}
              >
                {t("action.save")}
              </Button>
            </div>
          </>
        )}
      </div>
      <div className="admin-migration__section">
        <h2 className="admin-migration__section-title">{t("modal.migrationStart.title")}</h2>
        <div className="admin-migration__column">
          <TextField
            label={t("field.targetVolumeId")}
            value={targetVolumeId}
            onChange={(event) => setTargetVolumeId(event.target.value)}
            placeholder="volume-id"
          />
          <label className="admin-migration__checkbox">
            <input
              type="checkbox"
              checked={verifySha256}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setVerifySha256(event.target.checked)
              }
            />
            <span>{t("field.verifySha256")}</span>
          </label>
        </div>

        <label className="admin-migration__checkbox">
          <input
            type="checkbox"
            checked={deleteSourceAfter}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setDeleteSourceAfter(event.target.checked)
            }
          />
          <span>{t("field.deleteSourceAfter")}</span>
        </label>

        {migrationErrorKey ? <ErrorState title={t(migrationErrorKey)} /> : null}

        <div className="admin-migration__actions">
          <Button
            variant="primary"
            onClick={handleStartMigration}
            disabled={!targetVolumeId || migrationSubmitting}
            loading={migrationSubmitting}
          >
            {t("action.startMigration")}
          </Button>
        </div>
      </div>

      <section className="admin-migration__section">
        <h2 className="admin-migration__section-title">{t("admin.jobs.title")}</h2>

        {migrationJobLoading ? <LoadingSkeleton lines={3} /> : null}

        {migrationJobErrorKey ? <ErrorState title={t(migrationJobErrorKey)} /> : null}

        {migrationJob ? (
          <JobDetailsCard
            job={migrationJob}
            titleKey="admin.jobs.title"
            onRefresh={() => void fetchMigrationJob(migrationJob.id)}
            loading={migrationJobLoading}
            errorKey={migrationJobErrorKey}
          />
        ) : (
          <EmptyState title={t("msg.noJobs")} />
        )}
      </section>
    </section>
  );
}
