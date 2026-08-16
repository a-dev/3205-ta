import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomInt, randomUUID } from "node:crypto";

import { CreateJobDto } from "./dto/create-job.dto.js";
import { GetJobDetailDto } from "./dto/get-job.dto.js";
import { GetJobsDto, UrlStatusCountDto } from "./dto/get-jobs.dto.js";
import { URL_STATUSES, type UrlStatus } from "./dto/url-status.js";
import { Job } from "./interfaces/job.interface.js";
import { Url } from "./interfaces/url.interface.js";

const MAX_CONCURRENT_JOBS = 5;
const MAX_DELAY_MS = 10_000;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs = new Map<string, Job>();
  private readonly cancellations = new Map<string, AbortController>(); // AbortController for each job to cancel in-flight

  getJob(id: string): GetJobDetailDto {
    return this.toDetail(this.pickJob(id));
  }

  getJobs(): GetJobsDto {
    return {
      jobs: [...this.jobs.values()].map((job) => ({
        jobId: job.jobId,
        createdAt: job.createdAt,
        status: job.status,
        totalUrls: job.urls.length,
        urlStatuses: this.countStatuses(job.urls),
      })),
    };
  }

  createJob(urls: string[]): CreateJobDto {
    // Create the job and put urls with 'pending' status. Job itself is also 'pending'
    const jobId = randomUUID();
    const createdAt = new Date();
    const job: Job = {
      jobId,
      createdAt,
      status: "pending",
      urls: urls.map((url) => ({
        jobId,
        id: randomUUID(),
        url,
        createdAt,
        status: "pending",
      })),
    };

    this.jobs.set(jobId, job);

    const cancellation = new AbortController();
    this.cancellations.set(jobId, cancellation);

    // Snapshot the response first: runJob synchronously claims the first five URLs, so reading job.status afterwards would already report `in_progress`.
    const created: CreateJobDto = { jobId, urls, createdAt, status: job.status };

    // run jobs asynchronously
    void this.runJob(job, cancellation.signal).catch((error: unknown) => {
      this.logger.error(`Job ${jobId} failed`, error);
    });

    return created;
  }

  cancelJob(id: string): GetJobDetailDto {
    const job = this.pickJob(id);

    this.cancellations.get(id)?.abort();
    this.cancellations.delete(id);

    for (const entry of job.urls) {
      if (entry.status === "pending" || entry.status === "in_progress") {
        entry.status = "cancelled";
      }
    }
    job.status = "cancelled";

    return this.toDetail(job);
  }

  // Pool of jobs
  private async runJob(job: Job, signal: AbortSignal): Promise<void> {
    const queue = [...job.urls];
    const workerCount = Math.min(MAX_CONCURRENT_JOBS, queue.length);

    await Promise.all(
      Array.from({ length: workerCount }, () => this.processUrlQueue(queue, signal)),
    );

    this.cancellations.delete(job.jobId);
    this.refreshJobStatus(job);
  }

  private async processUrlQueue(queue: Url[], signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      // `shift` is safe to share between workers: it only ever runs on the single JS thread between awaits, so no two workers can claim the same entry.
      const entry = queue.shift();
      if (!entry) return;
      await this.checkUrl(entry, signal);
    }
  }

  // check if url exists by sending a HEAD request to it
  private async checkUrl(entry: Url, signal: AbortSignal): Promise<void> {
    const job = this.jobs.get(entry.jobId);

    entry.status = "in_progress";
    entry.startedAt = new Date();
    if (job) this.refreshJobStatus(job);

    let status: UrlStatus;
    let httpStatus: number | undefined;
    let error: string | undefined;

    try {
      const response = await fetch(entry.url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.any([signal, AbortSignal.timeout(MAX_DELAY_MS)]),
      });
      // any response counts as reachable 4xx and 5xx included
      status = "success";
      httpStatus = response.status;
    } catch (cause) {
      // network failure, timeout, or abort
      status = "error";
      error = describeError(cause);
    }

    await this.sleep(randomInt(0, MAX_DELAY_MS + 1), signal);

    if (signal.aborted) return;

    entry.status = status;
    entry.httpStatus = httpStatus;
    entry.error = error;
    entry.finishedAt = new Date();
    if (job) this.refreshJobStatus(job);
  }

  // time resolver with abort support
  private sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal.aborted) {
        resolve();
        return;
      }

      const onAbort = () => {
        clearTimeout(timer);
        resolve();
      };

      const timer = setTimeout(() => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      }, ms);

      signal.addEventListener("abort", onAbort, { once: true });
    });
  }

  // define job status based on the statuses of its URLs
  private refreshJobStatus(job: Job): void {
    if (job.status === "cancelled") return;

    const statuses = job.urls.map((entry) => entry.status);

    if (statuses.every((status) => status === "pending")) {
      job.status = "pending";
      return;
    }

    if (statuses.some((status) => status === "pending" || status === "in_progress")) {
      job.status = "in_progress";
      return;
    }

    job.status = statuses.includes("error") ? "failed" : "completed";
  }

  private countStatuses(urls: Url[]): UrlStatusCountDto[] {
    const counts = new Map<UrlStatus, number>();
    for (const entry of urls) {
      counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
    }

    return URL_STATUSES.filter((status) => counts.has(status)).map((status) => ({
      key: status,
      value: counts.get(status) as number,
    }));
  }

  private pickJob(id: string): Job {
    const job = this.jobs.get(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  private toDetail(job: Job): GetJobDetailDto {
    // Copy and add durationMs
    return {
      jobId: job.jobId,
      createdAt: job.createdAt,
      status: job.status,
      results: job.urls.map((entry) => ({
        id: entry.id,
        url: entry.url,
        status: entry.status,
        httpStatus: entry.httpStatus,
        error: entry.error,
        startedAt: entry.startedAt,
        finishedAt: entry.finishedAt,
        durationMs:
          entry.startedAt && entry.finishedAt
            ? entry.finishedAt.getTime() - entry.startedAt.getTime()
            : undefined,
      })),
    };
  }
}

function describeError(cause: unknown): string {
  // error not for user
  if (!(cause instanceof Error)) return String(cause);

  const inner: unknown = cause.cause;
  return inner instanceof Error && inner.message
    ? `${cause.message}: ${inner.message}`
    : cause.message;
}
