import { UrlStatus } from "../dto/url-status.js";

export type Url = {
  jobId: string;
  id: string;
  url: string;
  createdAt: Date;
  status: UrlStatus;
  httpStatus?: number;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
};
