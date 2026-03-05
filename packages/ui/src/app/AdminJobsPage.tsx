import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, DataTable, EmptyState, ErrorState, LoadingSkeleton, PageHeader, Toolbar } from "@nimbus/ui-kit";
import type { I18nKey } from "../i18n/t";
import { createJobsApi, type Job } from "../api/jobs";
import { ApiError } from "../api/errors";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import { JobDetailsCard } from "./JobDetailsCard";
import { t } from "../i18n/t";
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

const formatProgress = (value?: number | null) => {
  if (value === null || value === undefined) return "-";
  return `${Math.round(value * 100)}%`;
};

const formatTimestamp = (value?: string | null) => value ?? "-";

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
      setListErrorKey(error instanceof ApiError ? error.key : "err.network");
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
      setDetailErrorKey(error instanceof ApiError ? error.key : "err.network");
    } finally {
      setRefreshing(false);
    }
  }, [jobsApi, selectedJob]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const columns = useMemo(
    () => [
      {
        id: "id",
        header: t("field.jobId"),
        renderCell: (item: Job) => item.id,
      },
      {
        id: "type",
        header: t("field.jobType"),
        renderCell: (item: Job) => {
          const typeKey = JOB_TYPE_KEY_MAP[item.type];
          return typeKey ? t(typeKey) : item.type;
        },
      },
      {
        id: "status",
        header: t("field.jobStatus"),
        renderCell: (item: Job) => t(JOB_STATUS_KEY_MAP[item.status]),
      },
      {
        id: "progress",
        header: t("field.jobProgress"),
        renderCell: (item: Job) => formatProgress(item.progress),
      },
      {
        id: "createdAt",
        header: t("field.createdAt"),
        renderCell: (item: Job) => formatTimestamp(item.created_at),
      },
    ],
    [],
  );

  const hasJobs = jobs.length > 0;

  return (
    <section className="admin-jobs">
      <PageHeader
        title={t("admin.jobs.title")}
        actions={
          <Toolbar>
            <Button variant="ghost" onClick={loadJobs} disabled={loading || refreshing}>
              {t("action.refresh")}
            </Button>
          </Toolbar>
        }
      />

      <section className="admin-jobs__section">
        <h2 className="admin-jobs__section-title">실행중인 작업 목록</h2>

        {loading ? <LoadingSkeleton lines={6} /> : null}

        {listErrorKey ? <ErrorState title={t(listErrorKey)} /> : null}

        {!loading && !listErrorKey && !hasJobs ? <EmptyState title={t("msg.noJobs")} /> : null}

        {!loading && !listErrorKey && hasJobs ? (
          <div className="admin-jobs__table">
            <DataTable
              items={jobs}
              columns={columns}
              heightPx={240}
              rowHeightPx={44}
              getRowKey={(item) => item.id}
              onRowClick={setSelectedJob}
            />
          </div>
        ) : null}
      </section>

      <section className="admin-jobs__section">
        <h2 className="admin-jobs__section-title">작업 상세</h2>

        {!selectedJob ? <EmptyState title={t("admin.jobs.title")}
                                 detail={t("msg.noJobs")} /> : null}

        {selectedJob ? (
          <JobDetailsCard
            job={selectedJob}
            onRefresh={() => void refreshSelected()}
            loading={refreshing}
            titleKey="admin.jobs.title"
            errorKey={detailErrorKey}
          />
        ) : null}
      </section>
    </section>
  );
}
