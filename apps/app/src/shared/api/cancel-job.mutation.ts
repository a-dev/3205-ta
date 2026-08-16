import type { JobDetails } from "./types";

import { request } from "./client";

// DELETE /api/jobs/:id
export function cancelJob(jobId: string, signal?: AbortSignal): Promise<JobDetails> {
  return request<JobDetails>(`/jobs/${jobId}`, { method: "DELETE", signal });
}
