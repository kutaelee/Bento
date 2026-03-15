import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { createJobsApi, type Job } from "../api/jobs";
import { ApiError } from "../api/errors";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { JobDetailsCard } from "./JobDetailsCard";
import { t } from "../i18n/t";
import { formatDate } from "./format";
import { formatJobReference } from "./jobPresentation";
import "./AdminJobsPage.css";

const JOB_TYPE_KEY_MAP: Partial<Record<Job["type"], I18nKey>> = {
  MIGRATION: "status.jobTypeMigration",
  SCAN_CLEANUP: "status.jobTypeScanCleanup",
};

const JOB_STATUS_KEY_MAP: Record<Job["status"], I18nKey> = {
  QUEUED: "status.jobQueued",
  RUNNING: "status.jobRunning",
  SUCCEEDED: "status.jobDone",
  FAILED: "status.jobFailed",
  CANCELLED: "status.jobCancelled",
};

const metricStatuses: Job["status"][] = ["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"];

const formatProgress = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
};

function getTypeLabel(job: Job) {
  const typeKey = JOB_TYPE_KEY_MAP[job.type];
  return typeKey ? t(typeKey) : job.type;
}

export default function AdminJobsPage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);
  const jobsApi = useMemo(() => createJobsApi(apiClient), [apiClient]);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [listErrorKey, setListErrorKey] = useState<I18nKey | null>(null);
  const [detailErrorKey, setDetailErrorKey] = useState<I18nKey | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setListErrorKey(null);
    setDetailErrorKey(null);

    try {
      const items = await jobsApi.listJobs();
      const nextJobs = [...items].sort((left, right) =>
        left.created_at > right.created_at ? -1 : left.created_at < right.created_at ? 1 : 0,
      );
      setJobs(nextJobs);
      setSelectedJob((prev) => {
        if (!prev) return nextJobs[0] ?? null;
        return nextJobs.find((item) => item.id === prev.id) ?? nextJobs[0] ?? null;
      });
    } catch (error) {
      setListErrorKey(error instanceof ApiError ? error.key : "err.unknown");
      setJobs([]);
      setSelectedJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobsApi]);

  const refreshSelected = useCallback(async () => {
    if (!selectedJob) return;

    setRefreshing(true);
    setDetailErrorKey(null);
    try {
      const updated = await jobsApi.getJob(selectedJob.id);
      setSelectedJob(updated);
      setJobs((prev) => prev.map((job) => (job.id === updated.id ? updated : job)));
    } catch (error) {
      setDetailErrorKey(error instanceof ApiError ? error.key : "err.unknown");
    } finally {
      setRefreshing(false);
    }
  }, [jobsApi, selectedJob]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const statusCounts = useMemo(() => {
    return jobs.reduce<Record<Job["status"], number>>(
      (acc, job) => {
        acc[job.status] += 1;
        return acc;
      },
      {
        QUEUED: 0,
        RUNNING: 0,
        SUCCEEDED: 0,
        FAILED: 0,
        CANCELLED: 0,
      },
    );
  }, [jobs]);

  return (
    <section className="admin-jobs">
      <header className="admin-jobs__hero">
        <div className="admin-jobs__hero-copy">
          <p className="admin-jobs__eyebrow">{t("admin.jobs.runningSectionTitle")}</p>
          <h1 className="admin-jobs__title">{t("admin.jobs.title")}</h1>
          <p className="admin-jobs__subtitle">{t("admin.jobs.subtitle")}</p>
        </div>
        <div className="admin-jobs__hero-actions">
          <Button variant="secondary" onClick={loadJobs} disabled={loading || refreshing}>
            {t("action.refresh")}
          </Button>
        </div>
      </header>

      <section className="admin-jobs__summary">
        {metricStatuses.map((status) => (
          <article key={status} className="admin-jobs__summary-card">
            <span className="admin-jobs__summary-label">{t(JOB_STATUS_KEY_MAP[status])}</span>
            <strong className="admin-jobs__summary-value">{statusCounts[status]}</strong>
          </article>
        ))}
      </section>

      <section className="admin-jobs__layout">
        <div className="admin-jobs__panel">
          <div className="admin-jobs__panel-header">
            <div>
              <p className="admin-jobs__panel-eyebrow">{t("admin.jobs.runningSectionTitle")}</p>
              <h2 className="admin-jobs__panel-title">{t("admin.jobs.runningSectionTitle")}</h2>
            </div>
            <span className="admin-jobs__panel-count">{jobs.length}</span>
          </div>

          {loading ? <LoadingSkeleton lines={6} /> : null}

          {!loading && listErrorKey ? (
            <ErrorState
              title={t("err.unknown")}
              detail={t(listErrorKey)}
              action={
                <Button variant="secondary" onClick={loadJobs}>
                  {t("action.refresh")}
                </Button>
              }
            />
          ) : null}

          {!loading && !listErrorKey && jobs.length === 0 ? (
            <EmptyState title={t("msg.noJobs")} detail={t("admin.jobs.subtitle")} />
          ) : null}

          {!loading && !listErrorKey && jobs.length > 0 ? (
            <div className="admin-jobs__list">
              {jobs.map((job) => {
                const selected = selectedJob?.id === job.id;
                const progress = Math.max(0, Math.min(100, Math.round((job.progress ?? 0) * 100)));
                const typeLabel = getTypeLabel(job);
                const jobReference = formatJobReference(job, typeLabel);

                return (
                  <button
                    key={job.id}
                    type="button"
                    className={selected ? "admin-jobs__list-item admin-jobs__list-item--selected" : "admin-jobs__list-item"}
                    onClick={() => setSelectedJob(job)}
                    aria-pressed={selected}
                  >
                    <div className="admin-jobs__list-head">
                      <div>
                        <strong className="admin-jobs__list-id">{jobReference}</strong>
                        <p className="admin-jobs__list-type">{formatDate(job.created_at)}</p>
                      </div>
                      <span className={`admin-jobs__status admin-jobs__status--${job.status.toLowerCase()}`}>
                        {t(JOB_STATUS_KEY_MAP[job.status])}
                      </span>
                    </div>
                    <div className="admin-jobs__list-meta">
                      <span>{formatDate(job.created_at)}</span>
                      <span>{formatProgress(job.progress)}</span>
                    </div>
                    <div className="admin-jobs__progress-track" aria-hidden="true">
                      <div className="admin-jobs__progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="admin-jobs__panel admin-jobs__panel--detail">
          <div className="admin-jobs__panel-header">
            <div>
              <p className="admin-jobs__panel-eyebrow">{t("admin.jobs.detailSectionTitle")}</p>
              <h2 className="admin-jobs__panel-title">{t("admin.jobs.detailSectionTitle")}</h2>
            </div>
          </div>

          {!selectedJob ? (
            <EmptyState title={t("admin.jobs.detailSectionTitle")} detail={t("msg.noJobs")} />
          ) : (
            <JobDetailsCard
              job={selectedJob}
              onRefresh={() => void refreshSelected()}
              loading={refreshing}
              titleKey="admin.jobs.detailSectionTitle"
              errorKey={detailErrorKey}
            />
          )}
        </div>
      </section>
    </section>
  );
}
