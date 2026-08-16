export const URL_STATUSES = ["pending", "in_progress", "success", "error", "cancelled"] as const;

export type UrlStatus = (typeof URL_STATUSES)[number];
