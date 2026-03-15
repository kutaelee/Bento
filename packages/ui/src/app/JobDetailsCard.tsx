import React from "react";
import { Button } from "@nimbus/ui-kit";
import type { Job } from "../api/jobs";
import { t, type I18nKey } from "../i18n/t";
import { formatDate } from "./format";
import { formatJobReference } from "./jobPresentation";
import "./JobDetailsCard.css";

const jobStatusKeyMap: Record<Job["status"], I18nKey> = {
  QUEUED: "status.jobQueued",
  RUNNING: "status.jobRunning",
  SUCCEEDED: "status.jobDone",
  FAILED: "status.jobFailed",
  CANCELLED: "status.jobCancelled",
};

const jobTypeKeyMap: Partial<Record<Job["type"], I18nKey>> = {
  MIGRATION: "status.jobTypeMigration",
  SCAN_CLEANUP: "status.jobTypeScanCleanup",
};

const formatProgress = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
};

export type JobDetailsCardProps = {
  job: Job;
  titleKey?: I18nKey;
  onRefresh?: () => void;
  loading?: boolean;
  errorKey?: I18nKey | null;
};

export function JobDetailsCard({
  job,
  titleKey = "admin.jobs.detailSectionTitle",
  onRefresh,
  loading = false,
  errorKey = null,
}: JobDetailsCardProps) {
  const statusKey = jobStatusKeyMap[job.status];
  const typeKey = jobTypeKeyMap[job.type];
  const typeLabel = typeKey ? t(typeKey) : job.type;
  const jobReference = formatJobReference(job, typeLabel);
  const progressPercent = Math.max(0, Math.min(100, Math.round((job.progress ?? 0) * 100)));

  return (
    <article className="job-details-card">
      <header className="job-details-card__header">
        <div>
          <p className="job-details-card__eyebrow">{t(titleKey)}</p>
          <h2 className="job-details-card__title">{jobReference}</h2>
        </div>
        <div className="job-details-card__actions">
          <span className={`job-details-card__status job-details-card__status--${job.status.toLowerCase()}`}>
            {t(statusKey)}
          </span>
          {onRefresh ? (
            <Button variant="ghost" onClick={onRefresh} disabled={loading}>
              {t("action.refresh")}
            </Button>
          ) : null}
        </div>
      </header>

      {errorKey ? <div className="job-details-card__alert">{t(errorKey)}</div> : null}

      <section className="job-details-card__metrics">
        <div className="job-details-card__metric">
          <span className="job-details-card__label">{t("field.jobType")}</span>
          <strong className="job-details-card__metric-value">{typeLabel}</strong>
        </div>
        <div className="job-details-card__metric">
          <span className="job-details-card__label">{t("field.jobProgress")}</span>
          <strong className="job-details-card__metric-value">{formatProgress(job.progress)}</strong>
        </div>
      </section>

      <section className="job-details-card__progress">
        <div className="job-details-card__progress-head">
          <span className="job-details-card__label">{t("field.jobProgress")}</span>
          <span className="job-details-card__progress-value">{progressPercent}%</span>
        </div>
        <div className="job-details-card__progress-track" aria-hidden="true">
          <div className="job-details-card__progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <div className="job-details-card__grid">
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobId")}</span>
          <span className="job-details-card__value">{job.id}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobStatus")}</span>
          <span className="job-details-card__value">{t(statusKey)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.createdAt")}</span>
          <span className="job-details-card__value">{formatDate(job.created_at)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.startedAt")}</span>
          <span className="job-details-card__value">{formatDate(job.started_at)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.finishedAt")}</span>
          <span className="job-details-card__value">{formatDate(job.finished_at)}</span>
        </div>
      </div>
    </article>
  );
}
