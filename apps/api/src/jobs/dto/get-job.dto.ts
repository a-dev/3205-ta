import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

import { JOB_STATUSES, type JobStatus } from "./job-status.js";
import { URL_STATUSES, type UrlStatus } from "./url-status.js";

export class GetJobDto {
  @IsUUID("4")
  jobId: string;

  @IsDate()
  createdAt: Date;

  @IsIn(JOB_STATUSES)
  status: JobStatus;
}

export class UrlResultDto {
  @IsUUID("4")
  id: string;

  @IsUrl({ protocols: ["http", "https"], require_protocol: true })
  url: string;

  @IsIn(URL_STATUSES)
  status: UrlStatus;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  httpStatus?: number; // status is success

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsDate()
  startedAt?: Date; // processing start

  @IsOptional()
  @IsDate()
  finishedAt?: Date; // processing end

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number; // hm...
}

export class GetJobDetailDto extends GetJobDto {
  @IsArray()
  @ValidateNested({ each: true })
  results: UrlResultDto[];
}
