import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { JobDetailsCard } from "./JobDetailsCard";
import { t } from "../i18n/t";
import type { Job } from "../api/jobs";

const baseJob: Job = {
  id: "job-1",
  type: "MIGRATION",
  status: "RUNNING",
  progress: 0.42,
  payload: {},
  created_at: "2026-03-01T00:00:00Z",
  started_at: "2026-03-01T00:01:00Z",
  finished_at: null,
};

describe("JobDetailsCard", () => {
  it("renders job details", () => {
    const html = renderToStaticMarkup(<JobDetailsCard job={baseJob} />);
    expect(html).toContain("job-1");
    expect(html).toContain(t("status.jobRunning"));
    expect(html).toContain(t("field.jobId"));
    expect(html).toContain(t("field.jobStatus"));
  });
});
