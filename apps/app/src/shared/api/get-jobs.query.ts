import type { GetJobsResponse, JobSummary } from "./types";

import { request } from "./client";

// GET /api/jobs
export async function getJobs(signal?: AbortSignal): Promise<JobSummary[]> {
  const { jobs } = await request<GetJobsResponse>("/jobs", { signal });

  return [...jobs].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
