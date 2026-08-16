import type { CreatedJob } from "./types";

import { request } from "./client";

// POST /api/jobs
export function createJob(urls: string[], signal?: AbortSignal): Promise<CreatedJob> {
  return request<CreatedJob>("/jobs", { method: "POST", body: { urls }, signal });
}
