import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";

import { CreateJobDto } from "./dto/create-job.dto.js";
import { CreateJobRequestDto } from "./dto/create-job-request.dto.js";
import { DeleteJobDto } from "./dto/delete-job.dto.js";
import { GetJobDetailDto } from "./dto/get-job.dto.js";
import { GetJobsDto } from "./dto/get-jobs.dto.js";
import { JobsService } from "./jobs.service.js";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  getJobs(): GetJobsDto {
    return this.jobsService.getJobs();
  }

  @Get(":id")
  getJobById(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string): GetJobDetailDto {
    return this.jobsService.getJob(id);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  createJob(@Body() body: CreateJobRequestDto): CreateJobDto {
    return this.jobsService.createJob(body.urls);
  }

  @Delete(":id")
  deleteJob(@Param() { id }: DeleteJobDto): GetJobDetailDto {
    return this.jobsService.cancelJob(id);
  }
}
