import type { Job } from "../api/jobs";

export function getJobShortId(jobId: string) {
  return jobId.slice(-6).toUpperCase();
}

export function formatJobReference(job: Job, typeLabel: string) {
  return `${typeLabel} #${getJobShortId(job.id)}`;
}
