import { JOB_STATUSES, URL_STATUSES } from "./constants";

export type JobStatus = (typeof JOB_STATUSES)[number];
export type UrlStatus = (typeof URL_STATUSES)[number];

// the same as in the Nest backend (do not share for now)

export type UrlResult = {
  id: string;
  url: string;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
};

export type JobDetails = {
  jobId: string;
  createdAt: string;
  status: JobStatus;
  results: UrlResult[];
};

export type UrlStatusCount = {
  key: UrlStatus;
  value: number;
};

export type JobSummary = {
  jobId: string;
  createdAt: string;
  status: JobStatus;
  totalUrls: number;
  urlStatuses: UrlStatusCount[];
};

export type GetJobsResponse = {
  jobs: JobSummary[];
};

export type CreatedJob = {
  jobId: string;
  urls: string[];
  createdAt: string;
  status: JobStatus;
};
