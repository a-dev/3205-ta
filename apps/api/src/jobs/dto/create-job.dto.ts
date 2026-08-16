import { ArrayNotEmpty, IsArray, IsDate, IsIn, IsUrl, IsUUID } from "class-validator";

import { JOB_STATUSES, type JobStatus } from "./job-status.js";

export class CreateJobDto {
  @IsUUID("4")
  jobId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }, { each: true })
  urls: string[];

  @IsDate()
  createdAt: Date;

  @IsIn(JOB_STATUSES)
  status: JobStatus;
}
