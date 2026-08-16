import type { JobDetails } from "./types";

import { request } from "./client";

// GET /api/jobs/:id
export function getJob(jobId: string, signal?: AbortSignal): Promise<JobDetails> {
  return request<JobDetails>(`/jobs/${jobId}`, { signal });
}
