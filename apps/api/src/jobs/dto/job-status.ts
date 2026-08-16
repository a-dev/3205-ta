export const JOB_STATUSES = ["pending", "in_progress", "failed", "cancelled", "completed"] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];
