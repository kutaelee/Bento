import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  TextField,
  Toolbar,
} from "@nimbus/ui-kit";
import { ApiError } from "../api/errors";
import { t } from "../i18n/t";
import { getAuthenticatedApiClient } from "./authenticatedApiClient";
import "./AdminPerformancePage.css";
import type { components } from "../api/schema";

type QoSProfile = {
  id: string;
  name: string;
  throughput: string;
  thumbnailRps: string;
  transcodeConcurrency: string;
};

type MetricRow = {
  id: string;
  metric: string;
  profile: string;
  value: string;
  status: string;
};

type PerformanceState = components["schemas"]["PerformanceState"];

type UpdatePerformanceRequest = {
  profile: PerformanceState["profile"];
  limits?: {
    bg_worker_concurrency_max?: number;
    thumbnail_rps_max?: number;
    transcode_concurrency_max?: number;
  };
  allowed?: {
    bg_worker_concurrency?: number;
    thumbnail_rps?: number;
    transcode_concurrency?: number;
    notes?: string;
  };
};

const presets: QoSProfile[] = [
  {
    id: "ECO",
    name: "ECO",
    throughput: "Conservative",
    thumbnailRps: "8/s",
    transcodeConcurrency: "1",
  },
  {
    id: "BALANCED",
    name: "BALANCED",
    throughput: "Balanced",
    thumbnailRps: "14/s",
    transcodeConcurrency: "2",
  },
  {
    id: "PERFORMANCE",
    name: "PERFORMANCE",
    throughput: "High",
    thumbnailRps: "24/s",
    transcodeConcurrency: "3",
  },
];

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return String(value);
};

export default function AdminPerformancePage() {
  const apiClient = useMemo(() => getAuthenticatedApiClient(), []);

  const performanceApi = useMemo(
    () => ({
      getPerformance: () => apiClient.request<PerformanceState>({ path: "/system/performance" }),
      savePerformance: (payload: UpdatePerformanceRequest) =>
        apiClient.request<PerformanceState>({
          path: "/system/performance",
          method: "PATCH",
          body: payload,
        }),
    }),
    [apiClient],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [performanceState, setPerformanceState] = useState<PerformanceState | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState("BALANCED");
  const [customConcurrency, setCustomConcurrency] = useState("2");
  const [inputError, setInputError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const applyStateToUi = useCallback((nextState: PerformanceState) => {
    setPerformanceState(nextState);

    const nextProfile = nextState.profile;
    setSelectedProfileId(nextProfile);

    const nextConcurrency =
      nextState.allowed?.bg_worker_concurrency ??
      nextState.limits?.bg_worker_concurrency_max ??
      2;

    setCustomConcurrency(String(nextConcurrency));
    setSaved(false);
  }, []);

  const loadPerformance = useCallback(async () => {
    setLoading(true);
    setInputError(null);

    try {
      const response = await performanceApi.getPerformance();
      applyStateToUi(response);
    } catch (error) {
      setInputError(error instanceof ApiError ? t(error.key) : t("err.network"));
    } finally {
      setLoading(false);
    }
  }, [applyStateToUi, performanceApi]);

  useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const selectedProfile = useMemo(
    () => presets.find((profile) => profile.id === selectedProfileId) ?? presets[1],
    [selectedProfileId],
  );

  const profileColumns = useMemo(
    () => [
      {
        id: "name",
        header: t("admin.performance.column.profile"),
        renderCell: (item: QoSProfile) => item.name,
      },
      {
        id: "throughput",
        header: t("admin.performance.column.throughput"),
        renderCell: (item: QoSProfile) => item.throughput,
      },
      {
        id: "thumbnailRps",
        header: t("admin.performance.column.thumbnail"),
        align: "right" as const,
        renderCell: (item: QoSProfile) => item.thumbnailRps,
      },
      {
        id: "transcodeConcurrency",
        header: t("admin.performance.column.transcode"),
        align: "right" as const,
        renderCell: (item: QoSProfile) => item.transcodeConcurrency,
      },
    ],
    [],
  );

  const snapshotRows: MetricRow[] = useMemo(() => {
    const profileName = performanceState?.profile ?? selectedProfile.name;

    return [
      {
        id: "qos",
        metric: t("admin.performance.metric.profile"),
        profile: t("admin.performance.metric.applied"),
        value: profileName,
        status: t("status.ok"),
      },
      {
        id: "worker",
        metric: t("admin.performance.input.concurrency"),
        profile: t("admin.performance.metric.profile"),
        value: formatNumber(performanceState?.limits?.bg_worker_concurrency_max),
        status:
          performanceState === null || Number(performanceState.limits?.bg_worker_concurrency_max) > 0
            ? t("status.ok")
            : t("status.fail"),
      },
      {
        id: "thumbnail",
        metric: t("admin.performance.column.thumbnail"),
        profile: t("admin.performance.metric.profile"),
        value: formatNumber(performanceState?.limits?.thumbnail_rps_max),
        status: formatNumber(performanceState?.pressure?.api_p95_ms),
      },
    ];
  }, [performanceState, selectedProfile]);

  const snapshotColumns = useMemo(
    () => [
      {
        id: "metric",
        header: t("admin.performance.metric.profile"),
        renderCell: (item: MetricRow) => item.metric,
      },
      {
        id: "profile",
        header: t("admin.performance.metric.applied"),
        renderCell: (item: MetricRow) => item.profile,
      },
      {
        id: "value",
        header: t("admin.performance.metric.value"),
        align: "right" as const,
        renderCell: (item: MetricRow) => item.value,
      },
      {
        id: "status",
        header: t("admin.performance.metric.status"),
        renderCell: (item: MetricRow) => item.status,
      },
    ],
    [],
  );

  const onSave = async () => {
    const concurrency = Number(customConcurrency);
    if (!customConcurrency || !Number.isFinite(concurrency) || concurrency <= 0) {
      setInputError(t("admin.performance.message.invalidConcurrency"));
      setSaved(false);
      return;
    }

    setInputError(null);
    setSaved(false);
    setSaving(true);

    try {
      const payload: UpdatePerformanceRequest = {
        profile: selectedProfile.id as PerformanceState["profile"],
      };

      if (selectedProfile.id === "CUSTOM") {
        payload.limits = {
          bg_worker_concurrency_max: concurrency,
        };
        payload.allowed = {
          bg_worker_concurrency: concurrency,
        };
      }

      await performanceApi.savePerformance(payload);
      await loadPerformance();
      setSaved(true);
    } catch (error) {
      setInputError(error instanceof ApiError ? t(error.key) : t("err.network"));
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const onReload = () => {
    void loadPerformance();
  };

  const onProfileSelect = (item: QoSProfile) => {
    setSelectedProfileId(item.id);
    setSaved(false);
    setInputError(null);
  };

  const onConcurrencyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomConcurrency(event.currentTarget.value);
    setSaved(false);
    setInputError(null);
  };

  return (
    <section className="admin-performance">
      <PageHeader
        title={t("admin.performance.title")}
        actions={
          <Toolbar>
            <Button variant="ghost" onClick={onReload} disabled={loading || saving}>
              {t("action.refresh")}
            </Button>
          </Toolbar>
        }
      />

      <section className="admin-performance__section">
        <h2 className="admin-performance__section-title">{t("admin.performance.profileSection")}</h2>
        {loading ? <LoadingSkeleton lines={6} /> : null}

        {!loading &&
          (presets.length === 0 ? (
            <EmptyState
              title={t("admin.performance.message.noProfiles")}
              detail={t("admin.performance.message.noProfilesDetail")}
            />
          ) : (
            <DataTable
              items={presets}
              columns={profileColumns}
              heightPx={220}
              rowHeightPx={48}
              getRowKey={(item) => item.id}
              onRowClick={onProfileSelect}
            />
          ))}
      </section>

      <section className="admin-performance__section">
        <h2 className="admin-performance__section-title">{t("admin.performance.settingSection")}</h2>

        {loading ? <LoadingSkeleton lines={3} /> : null}

        {(!loading && inputError) ? <ErrorState title={inputError} /> : null}

        <TextField
          label={t("admin.performance.input.concurrency")}
          value={customConcurrency}
          onChange={onConcurrencyChange}
          placeholder="2"
        />

        <div className="admin-performance__actions">
            <Button
              variant="primary"
              onClick={() => void onSave()}
              disabled={!selectedProfile || loading || saving}
            >
            {saving ? t("admin.performance.saving") : t("action.save")}
            </Button>
        </div>

        {saved ? <p className="admin-performance__muted">{t("admin.performance.message.saveDone")}</p> : null}
      </section>

      <section className="admin-performance__section">
        <h2 className="admin-performance__section-title">{t("admin.performance.snapshotSection")}</h2>

        {loading ? <LoadingSkeleton lines={5} /> : null}

        {!loading && snapshotRows.length === 0 ? <EmptyState title={t("msg.noJobs")} /> : null}

        {!loading && snapshotRows.length > 0 ? (
          <DataTable
            items={snapshotRows}
            columns={snapshotColumns}
            heightPx={160}
            rowHeightPx={48}
            getRowKey={(item) => item.id}
          />
        ) : null}
      </section>
    </section>
  );
}
