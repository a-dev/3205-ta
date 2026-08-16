import { JobStatus } from "../dto/job-status.js";
import { Url } from "./url.interface.js";

export type Job = {
  jobId: string;
  urls: Url[];
  createdAt: Date;
  status: JobStatus; // ???
};
