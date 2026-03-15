import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  LoadingSkeleton,
  TextField,
} from "@nimbus/ui-kit";
import { useNavigate } from "react-router-dom";
import { createAdminMaintenanceApi } from "../api/adminMaintenance";
import { ApiError } from "../api/errors";
import { createJobsApi, type Job } from "../api/jobs";
import { createSystemModeApi } from "../api/systemMode";
import { t, type I18nKey } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { JobDetailsCard } from "./JobDetailsCard";
import "./AdminMigrationPage.css";

export default function AdminMigrationPage() {
  const navigate = useNavigate();
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
    } catch (error) {
      setLoadErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setLoading(false);
    }
  }, [submitting, systemModeApi]);

  useEffect(() => {
    void loadStatus();
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

  const summaryItems = useMemo(
    () => [
      {
        label: t("admin.migration.summary.mode"),
        value: readOnly ? t("admin.migration.summary.readOnly") : t("admin.migration.summary.readWrite"),
      },
      {
        label: t("admin.migration.summary.integrity"),
        value: verifySha256 ? t("admin.migration.summary.enabled") : t("admin.migration.summary.disabled"),
      },
      {
        label: t("admin.migration.summary.cleanup"),
        value: deleteSourceAfter ? t("admin.migration.summary.enabled") : t("admin.migration.summary.disabled"),
      },
    ],
    [deleteSourceAfter, readOnly, verifySha256],
  );

  if (loadErrorKey === "err.forbidden") {
    return (
      <ForbiddenState
        title={t("err.forbidden")}
        detail={t("msg.forbiddenAdmin")}
      />
    );
  }

  if (loadErrorKey) {
    return (
      <ErrorState
        title={t("err.unknown")}
        detail={t(loadErrorKey)}
        action={
          <Button variant="secondary" onClick={() => void loadStatus()}>
            {t("action.retry")}
          </Button>
        }
      />
    );
  }

  return (
    <section className="admin-migration">
      <header className="admin-migration__hero">
        <div className="admin-migration__hero-copy">
          <p className="admin-migration__eyebrow">{t("admin.home.quickLinksTitle")}</p>
          <h1 className="admin-migration__title">{t("admin.migration.title")}</h1>
          <p className="admin-migration__subtitle">{t("admin.migration.subtitle")}</p>
        </div>
        <div className="admin-migration__hero-actions">
          <Button variant="secondary" onClick={() => void loadStatus()} disabled={loading || submitting}>
            {t("action.refresh")}
          </Button>
        </div>
      </header>

      <section className="admin-migration__summary">
        {summaryItems.map((item) => (
          <article key={item.label} className="admin-migration__summary-card">
            <span className="admin-migration__summary-label">{item.label}</span>
            <strong className="admin-migration__summary-value">{item.value}</strong>
          </article>
        ))}
      </section>

      <div className="admin-migration__layout">
        <section className="admin-migration__stack">
          <article className="admin-migration__panel">
            <div className="admin-migration__panel-header">
              <div>
                <p className="admin-migration__panel-eyebrow">{t("admin.migration.title")}</p>
                <h2 className="admin-migration__panel-title">{t("status.readOnly")}</h2>
              </div>
            </div>
            <p className="admin-migration__panel-copy">{t("admin.migration.modeDescription")}</p>

            {loading ? (
              <LoadingSkeleton lines={4} />
            ) : (
              <>
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
                {submitErrorKey ? <p className="admin-migration__alert">{t(submitErrorKey)}</p> : null}
                {saved ? <p className="admin-migration__success">{t("msg.changesSaved")}</p> : null}
                <div className="admin-migration__actions">
                  <Button variant="primary" onClick={handleSubmit} disabled={!isDirty || submitting} loading={submitting}>
                    {t("action.save")}
                  </Button>
                </div>
              </>
            )}
          </article>

          <article className="admin-migration__panel">
            <div className="admin-migration__panel-header">
              <div>
                <p className="admin-migration__panel-eyebrow">{t("admin.migration.title")}</p>
                <h2 className="admin-migration__panel-title">{t("modal.migrationStart.title")}</h2>
              </div>
            </div>
            <p className="admin-migration__panel-copy">{t("admin.migration.formDescription")}</p>

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
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => setVerifySha256(event.target.checked)}
                />
                <span>{t("field.verifySha256")}</span>
              </label>
            </div>

            <label className="admin-migration__checkbox">
              <input
                type="checkbox"
                checked={deleteSourceAfter}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setDeleteSourceAfter(event.target.checked)}
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
          </article>
        </section>

        <section className="admin-migration__panel admin-migration__panel--jobs">
          <div className="admin-migration__panel-header">
            <div>
              <p className="admin-migration__panel-eyebrow">{t("admin.jobs.title")}</p>
              <h2 className="admin-migration__panel-title">{t("admin.migration.jobsTitle")}</h2>
            </div>
          </div>
          <p className="admin-migration__panel-copy">{t("admin.migration.jobsDescription")}</p>

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
      </div>
    </section>
  );
}
