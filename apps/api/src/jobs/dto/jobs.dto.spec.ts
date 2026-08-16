import { validateSync } from "class-validator";

import { CreateJobDto } from "./create-job.dto.js";
import { DeleteJobDto } from "./delete-job.dto.js";
import { GetJobDetailDto, GetJobDto, UrlResultDto } from "./get-job.dto.js";
import { GetJobsDto, JobSummaryDto, UrlStatusCountDto } from "./get-jobs.dto.js";

const JOB_ID = "e8614e15-e638-4b80-89f2-b657d2a73eaf";
const URL_ID = "1f0a4f9c-6a3d-4e4a-9f2b-2c1d0e7b5a63";
const CREATED_AT = new Date("2026-08-13T00:00:00.000Z");

describe("CreateJobDto", () => {
  it("accepts a valid job", () => {
    const dto = Object.assign(new CreateJobDto(), {
      jobId: JOB_ID,
      urls: ["https://example.com/health"],
      createdAt: CREATED_AT,
      status: "pending" as const,
    });

    expect(validateSync(dto)).toEqual([]);
  });

  it("rejects invalid identifiers, URLs, dates, and statuses", () => {
    const dto = Object.assign(new CreateJobDto(), {
      jobId: "not-a-uuid",
      urls: ["example.com"],
      createdAt: "2026-08-13",
      status: "unknown",
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual([
      "jobId",
      "urls",
      "createdAt",
      "status",
    ]);
  });

  it("rejects a URL status where a job status is required", () => {
    const dto = Object.assign(new CreateJobDto(), {
      jobId: JOB_ID,
      urls: ["https://example.com/health"],
      createdAt: CREATED_AT,
      status: "success",
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(["status"]);
  });
});

describe("GetJobDto", () => {
  it("accepts a valid job", () => {
    const dto = Object.assign(new GetJobDto(), {
      jobId: JOB_ID,
      createdAt: CREATED_AT,
      status: "in_progress" as const,
    });

    expect(validateSync(dto)).toEqual([]);
  });

  it("rejects invalid identifiers, dates, and statuses", () => {
    const dto = Object.assign(new GetJobDto(), {
      jobId: "not-a-uuid",
      createdAt: "2026-08-13",
      status: "success",
    });

    expect(validateSync(dto).map(({ property }) => property)).toEqual([
      "jobId",
      "createdAt",
      "status",
    ]);
  });
});

describe("GetJobDetailDto", () => {
  function urlResult(overrides: Partial<UrlResultDto> = {}): UrlResultDto {
    return Object.assign(new UrlResultDto(), {
      id: URL_ID,
      url: "https://example.com/health",
      status: "success" as const,
      httpStatus: 200,
      startedAt: CREATED_AT,
      finishedAt: new Date("2026-08-13T00:00:04.000Z"),
      durationMs: 4000,
      ...overrides,
    });
  }

  it("accepts a job with per-URL results", () => {
    const dto = Object.assign(new GetJobDetailDto(), {
      jobId: JOB_ID,
      createdAt: CREATED_AT,
      status: "completed" as const,
      results: [urlResult()],
    });

    expect(validateSync(dto)).toEqual([]);
  });

  it("accepts a result that has not settled yet", () => {
    const dto = urlResult({
      status: "pending",
      httpStatus: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      durationMs: undefined,
    });

    expect(validateSync(dto)).toEqual([]);
  });

  it("rejects an out-of-range HTTP status and a negative duration", () => {
    const dto = urlResult({ httpStatus: 42, durationMs: -1 });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(["httpStatus", "durationMs"]);
  });

  it("rejects a job status where a URL status is required", () => {
    const dto = urlResult({ status: "completed" as never });

    expect(validateSync(dto).map(({ property }) => property)).toEqual(["status"]);
  });
});

describe("DeleteJobDto", () => {
  it("only accepts a UUID v4 job identifier", () => {
    expect(validateSync(Object.assign(new DeleteJobDto(), { id: JOB_ID }))).toEqual([]);
    expect(validateSync(Object.assign(new DeleteJobDto(), { id: "42" }))).toHaveLength(1);
  });
});

describe("GetJobsDto", () => {
  it("accepts valid nested job summaries", () => {
    // `urlStatuses` counts URL statuses, so `success` is valid here even though it
    // is not a job status; the summary's own `status` uses the job vocabulary.
    const status = Object.assign(new UrlStatusCountDto(), {
      key: "success" as const,
      value: 2,
    });
    const job = Object.assign(new JobSummaryDto(), {
      jobId: JOB_ID,
      createdAt: CREATED_AT,
      status: "completed" as const,
      totalUrls: 2,
      urlStatuses: [status],
    });
    const dto = Object.assign(new GetJobsDto(), { jobs: [job] });

    expect(validateSync(dto)).toEqual([]);
  });

  it("rejects invalid nested job summaries", () => {
    const status = Object.assign(new UrlStatusCountDto(), {
      key: "unknown",
      value: -1,
    });
    const job = Object.assign(new JobSummaryDto(), {
      jobId: "not-a-uuid",
      createdAt: "2026-08-13",
      urlStatuses: [status, status],
    });
    const dto = Object.assign(new GetJobsDto(), { jobs: [job] });

    expect(validateSync(dto)).not.toEqual([]);
  });
});
