export const JOB_STATUSES = ["pending", "in_progress", "failed", "cancelled", "completed"] as const;
export const URL_STATUSES = ["pending", "in_progress", "success", "error", "cancelled"] as const;

// Client stops polling on these statuses
export const STOP_PULLING_JOB_STATUSES = ["completed", "cancelled", "failed"] as const;

export const API_URL = "/api";
