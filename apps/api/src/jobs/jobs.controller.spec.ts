import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { CreateJobDto } from "./dto/create-job.dto.js";
import { CreateJobRequestDto } from "./dto/create-job-request.dto.js";
import { GetJobDetailDto } from "./dto/get-job.dto.js";
import { GetJobsDto } from "./dto/get-jobs.dto.js";
import { JobsController } from "./jobs.controller.js";
import { JobsService } from "./jobs.service.js";

const JOB_ID = "e8614e15-e638-4b80-89f2-b657d2a73eaf";
const CREATED_AT = new Date("2026-08-13T00:00:00.000Z");

const detail: GetJobDetailDto = {
  jobId: JOB_ID,
  createdAt: CREATED_AT,
  status: "completed",
  results: [],
};

describe("JobsController", () => {
  let controller: JobsController;
  let service: {
    getJob: ReturnType<typeof vi.fn<JobsService["getJob"]>>;
    getJobs: ReturnType<typeof vi.fn<JobsService["getJobs"]>>;
    createJob: ReturnType<typeof vi.fn<JobsService["createJob"]>>;
    cancelJob: ReturnType<typeof vi.fn<JobsService["cancelJob"]>>;
  };

  beforeEach(async () => {
    service = {
      getJob: vi.fn(),
      getJobs: vi.fn(),
      createJob: vi.fn(),
      cancelJob: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [{ provide: JobsService, useValue: service }],
    }).compile();

    controller = module.get(JobsController);
  });

  it("returns the job list unchanged", () => {
    const jobs: GetJobsDto = { jobs: [] };
    service.getJobs.mockReturnValue(jobs);

    expect(controller.getJobs()).toBe(jobs);
    expect(service.getJobs).toHaveBeenCalledWith();
  });

  it("looks a job up by the id from the path", () => {
    service.getJob.mockReturnValue(detail);

    expect(controller.getJobById(JOB_ID)).toBe(detail);
    expect(service.getJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("passes only the URL list from the request body to the service", () => {
    const created: CreateJobDto = {
      jobId: JOB_ID,
      urls: ["https://example.com/health"],
      createdAt: CREATED_AT,
      status: "pending",
    };
    service.createJob.mockReturnValue(created);

    const body = Object.assign(new CreateJobRequestDto(), {
      urls: ["https://example.com/health"],
    });

    expect(controller.createJob(body)).toBe(created);
    expect(service.createJob).toHaveBeenCalledWith(body.urls);
  });

  it("cancels the job named by the delete params", () => {
    const cancelled: GetJobDetailDto = { ...detail, status: "cancelled" };
    service.cancelJob.mockReturnValue(cancelled);

    expect(controller.deleteJob({ id: JOB_ID })).toBe(cancelled);
    expect(service.cancelJob).toHaveBeenCalledWith(JOB_ID);
  });

  it("lets a missing job surface as a 404 instead of swallowing it", () => {
    const missing = new NotFoundException(`Job ${JOB_ID} not found`);
    service.getJob.mockImplementation(() => {
      throw missing;
    });
    service.cancelJob.mockImplementation(() => {
      throw missing;
    });

    expect(() => controller.getJobById(JOB_ID)).toThrow(missing);
    expect(() => controller.deleteJob({ id: JOB_ID })).toThrow(missing);
  });
});
