import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

import { JOB_STATUSES, type JobStatus } from "./job-status.js";
import { URL_STATUSES, type UrlStatus } from "./url-status.js";

export class UrlStatusCountDto {
  @IsIn(URL_STATUSES)
  key: UrlStatus;

  @IsInt()
  @Min(0)
  value: number;
}

export class JobSummaryDto {
  @IsUUID("4")
  jobId: string;

  @IsDate()
  createdAt: Date;

  @IsIn(JOB_STATUSES)
  status: JobStatus;

  @IsInt()
  @Min(0)
  totalUrls: number;

  @IsArray()
  @ArrayUnique((status: UrlStatusCountDto | null | undefined) => status?.key)
  @ValidateNested({ each: true })
  urlStatuses: UrlStatusCountDto[];
}

export class GetJobsDto {
  @IsArray()
  @ValidateNested({ each: true })
  jobs: JobSummaryDto[];
}
