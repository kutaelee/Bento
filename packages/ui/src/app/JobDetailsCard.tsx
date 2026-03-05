import React from "react";
import { Button } from "@nimbus/ui-kit";
import type { Job } from "../api/jobs";
import { t, type I18nKey } from "../i18n/t";
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

const formatTimestamp = (value?: string | null) => value ?? "-";

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
  titleKey = "admin.jobs.title",
  onRefresh,
  loading = false,
  errorKey = null,
}: JobDetailsCardProps) {
  const statusKey = jobStatusKeyMap[job.status];
  const typeKey = jobTypeKeyMap[job.type];
  const typeLabel = typeKey ? t(typeKey) : job.type;

  return (
    <div className="job-details-card">
      <div className="job-details-card__header">
        <h2 className="job-details-card__title">{t(titleKey)}</h2>
        {onRefresh ? (
          <Button variant="ghost" onClick={onRefresh} disabled={loading}>
            {t("action.refresh")}
          </Button>
        ) : null}
      </div>
      {errorKey ? <div className="job-details-card__alert">{t(errorKey)}</div> : null}
      <div className="job-details-card__grid">
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobId")}</span>
          <span className="job-details-card__value">{job.id}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobType")}</span>
          <span className="job-details-card__value">{typeLabel}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobStatus")}</span>
          <span className="job-details-card__value">{t(statusKey)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.jobProgress")}</span>
          <span className="job-details-card__value">{formatProgress(job.progress)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.createdAt")}</span>
          <span className="job-details-card__value">{formatTimestamp(job.created_at)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.startedAt")}</span>
          <span className="job-details-card__value">{formatTimestamp(job.started_at)}</span>
        </div>
        <div className="job-details-card__row">
          <span className="job-details-card__label">{t("field.finishedAt")}</span>
          <span className="job-details-card__value">{formatTimestamp(job.finished_at)}</span>
        </div>
      </div>
    </div>
  );
}
