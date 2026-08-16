import type { UrlResult, UrlStatus } from "@/shared/api/types";

export type JobStats = {
  total: number;
  success: number;
  error: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  /** success + error + cancelled → "X of Y processed". */
  processed: number;
};
