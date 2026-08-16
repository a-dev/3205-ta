import { NotFoundException } from "@nestjs/common";

import { JobsService } from "./jobs.service.js";

// The artificial 0-10s delay is what makes these checks slow; pin it to zero so the
// scheduling behaviour can be tested without waiting on wall-clock time. Tests that
// need a delay window to act inside raise the value themselves.
const randomInt = vi.hoisted(() => vi.fn(() => 0));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt };
});

/** Lets the microtask queue and zero-delay timers drain. */
async function tick(times = 5): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function waitFor(assertion: () => void): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  assertion();
}

function urls(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `https://example.com/${index}`);
}

/** A `fetch` stub that holds every request open until it is explicitly released. */
function blockingFetch() {
  const releases: Array<(response: Response) => void> = [];
  let inFlight = 0;
  let peakInFlight = 0;

  const impl = vi.fn((_url: string, _init?: RequestInit) => {
    inFlight++;
    peakInFlight = Math.max(peakInFlight, inFlight);
    return new Promise<Response>((resolve) => {
      releases.push((response) => {
        inFlight--;
        resolve(response);
      });
    });
  });

  vi.stubGlobal("fetch", impl);

  return {
    impl,
    releases,
    get inFlight() {
      return inFlight;
    },
    get peakInFlight() {
      return peakInFlight;
    },
    releaseAll(status = 200) {
      for (const release of releases.splice(0)) release(new Response(null, { status }));
    },
  };
}

describe("JobsService", () => {
  let service: JobsService;

  beforeEach(() => {
    randomInt.mockImplementation(() => 0);
    service = new JobsService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns a pending job immediately, before any URL has been checked", () => {
    blockingFetch();

    const job = service.createJob(urls(3));

    expect(job.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect(job.status).toBe("pending");
    expect(job.urls).toHaveLength(3);
    expect(service.getJob(job.jobId).results.every(({ status }) => status !== "success")).toBe(
      true,
    );
  });

  it("runs at most 5 HEAD requests at a time for a single job", async () => {
    const stub = blockingFetch();

    service.createJob(urls(12));
    await tick();

    expect(stub.inFlight).toBe(5);
    expect(stub.peakInFlight).toBe(5);
    expect(stub.impl).toHaveBeenCalledTimes(5);
    expect(stub.impl.mock.calls[0]?.[1]).toMatchObject({ method: "HEAD" });

    // Freeing one slot admits exactly one more URL.
    stub.releases.splice(0, 1)[0]?.(new Response(null, { status: 200 }));
    await tick();

    expect(stub.impl).toHaveBeenCalledTimes(6);
    expect(stub.peakInFlight).toBe(5);
  });

  it("processes several jobs concurrently", async () => {
    const stub = blockingFetch();

    service.createJob(urls(6));
    service.createJob(urls(6));
    await tick();

    // 5 per job, not 5 overall.
    expect(stub.inFlight).toBe(10);
  });

  it("records any HTTP response as success and network failures as error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/1")
          ? Promise.reject(new TypeError("fetch failed"))
          : Promise.resolve(new Response(null, { status: 404 })),
      ),
    );

    const { jobId: id } = service.createJob(urls(3));

    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    const results = service.getJob(id).results;
    expect(results.map(({ status }) => status)).toEqual(["success", "error", "success"]);
    expect(results[0]?.httpStatus).toBe(404);
    expect(results[1]?.httpStatus).toBeUndefined();
    expect(results[0]?.finishedAt).toBeInstanceOf(Date);

    // The failure reason must reach the client, not just the status.
    expect(results[1]?.error).toBe("fetch failed");
    expect(results[0]?.error).toBeUndefined();
  });

  it("surfaces the underlying cause of a network failure", async () => {
    const failure = new TypeError("fetch failed");
    failure.cause = new Error("connect ECONNREFUSED 127.0.0.1:9");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(failure)),
    );

    const { jobId: id } = service.createJob(urls(1));
    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    expect(service.getJob(id).results[0]?.error).toBe(
      "fetch failed: connect ECONNREFUSED 127.0.0.1:9",
    );
  });

  it("times each URL from start to stored result", async () => {
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(6));
    await tick();

    // Five are running, the sixth is still queued behind them.
    const running = service.getJob(id).results;
    expect(running.slice(0, 5).every(({ startedAt }) => startedAt instanceof Date)).toBe(true);
    expect(running.slice(0, 5).every(({ finishedAt }) => finishedAt === undefined)).toBe(true);
    expect(running.slice(0, 5).every(({ durationMs }) => durationMs === undefined)).toBe(true);
    expect(running[5]?.startedAt).toBeUndefined();

    stub.releaseAll();
    await tick();
    stub.releaseAll();
    await tick();

    for (const result of service.getJob(id).results) {
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.finishedAt).toBeInstanceOf(Date);
      // durationMs must stay consistent with the two timestamps it is derived from.
      expect(result.durationMs).toBe(
        (result.finishedAt as Date).getTime() - (result.startedAt as Date).getTime(),
      );
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("reports completed only when every URL responded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );

    const { jobId: id } = service.createJob(urls(7));

    await waitFor(() => expect(service.getJob(id).status).toBe("completed"));
    expect(service.getJobs().jobs[0]?.urlStatuses).toEqual([{ key: "success", value: 7 }]);
  });

  it("cancels unfinished URLs and discards results that arrive after deletion", async () => {
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(12));
    await tick();

    const cancelled = service.cancelJob(id);

    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.results.every(({ status }) => status === "cancelled")).toBe(true);
    expect(stub.impl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);

    // Responses for the aborted requests must not overwrite the cancelled state,
    // and no further URLs may be started.
    stub.releaseAll();
    await tick();

    expect(stub.impl).toHaveBeenCalledTimes(5);
    expect(service.getJob(id).results.every(({ status }) => status === "cancelled")).toBe(true);
    expect(service.getJob(id).status).toBe("cancelled");
  });

  it("keeps results that were already recorded when the job is cancelled", async () => {
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(8));
    await tick();

    stub.releases.splice(0, 2).forEach((release) => release(new Response(null, { status: 200 })));
    await tick();

    const cancelled = service.cancelJob(id);
    const statuses = cancelled.results.map(({ status }) => status);

    expect(statuses.filter((status) => status === "success")).toHaveLength(2);
    expect(statuses.filter((status) => status === "cancelled")).toHaveLength(6);
  });

  it("summarises each job with its own status plus per-URL counts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/0")
          ? Promise.reject(new TypeError("fetch failed"))
          : Promise.resolve(new Response(null, { status: 200 })),
      ),
    );

    const { jobId: id } = service.createJob(urls(4));
    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    // The list view needs id, creation date, job status, and URL statistics.
    expect(service.getJobs()).toEqual({
      jobs: [
        {
          jobId: id,
          createdAt: expect.any(Date),
          status: "failed",
          totalUrls: 4,
          // Ordered by URL_STATUSES; statuses with no URLs are omitted.
          urlStatuses: [
            { key: "success", value: 3 },
            { key: "error", value: 1 },
          ],
        },
      ],
    });
  });

  it("throws NotFoundException for an unknown job", () => {
    expect(() => service.getJob("6ad2b5f4-9e0d-4f1b-9d4e-6f0f6a9f0a11")).toThrow(NotFoundException);
    expect(() => service.cancelJob("6ad2b5f4-9e0d-4f1b-9d4e-6f0f6a9f0a11")).toThrow(
      NotFoundException,
    );
  });

  it("echoes the submitted URLs and stamps every entry with the same creation time", () => {
    blockingFetch();

    const submitted = urls(3);
    const created = service.createJob(submitted);

    expect(created.urls).toEqual(submitted);
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(service.getJob(created.jobId).createdAt).toEqual(created.createdAt);
  });

  it("keeps duplicate URLs as separate entries with their own identifiers", () => {
    blockingFetch();

    const duplicate = "https://example.com/same";
    const { jobId: id } = service.createJob([duplicate, duplicate]);
    const results = service.getJob(id).results;

    expect(results.map(({ url }) => url)).toEqual([duplicate, duplicate]);
    expect(new Set(results.map(({ id: urlId }) => urlId)).size).toBe(2);
  });

  it("switches the stored job to in_progress while the caller still sees the pending snapshot", () => {
    blockingFetch();

    const created = service.createJob(urls(3));

    // The response is a snapshot taken before the first URL was claimed; the stored
    // job has already moved on by the time the caller reads it back.
    expect(created.status).toBe("pending");
    expect(service.getJob(created.jobId).status).toBe("in_progress");
  });

  it("sends a redirect-following HEAD request carrying an abort signal", () => {
    const stub = blockingFetch();

    service.createJob(urls(1));

    expect(stub.impl).toHaveBeenCalledWith("https://example.com/0", {
      method: "HEAD",
      redirect: "follow",
      signal: expect.any(AbortSignal),
    });
  });

  it("waits a random 0-10s after each check before recording the result", async () => {
    randomInt.mockReturnValue(1_000);
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(1));
    await tick();
    stub.releaseAll();
    await tick();

    // The response is in, but the artificial delay has not elapsed, so nothing is stored yet.
    expect(randomInt).toHaveBeenCalledWith(0, 10_001);
    expect(service.getJob(id).results[0]).toMatchObject({
      status: "in_progress",
      httpStatus: undefined,
      finishedAt: undefined,
    });
  });

  it("discards a result whose delay is still running when the job is cancelled", async () => {
    randomInt.mockReturnValue(1_000);
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(1));
    await tick();
    stub.releaseAll();
    await tick();

    service.cancelJob(id);
    await tick();

    expect(service.getJob(id).results[0]).toMatchObject({
      status: "cancelled",
      httpStatus: undefined,
      finishedAt: undefined,
    });
  });

  it("treats a server error response as a reachable URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 503 }))),
    );

    const { jobId: id } = service.createJob(urls(1));
    await waitFor(() => expect(service.getJob(id).status).toBe("completed"));

    expect(service.getJob(id).results[0]).toMatchObject({ status: "success", httpStatus: 503 });
  });

  it("stringifies a rejection that is not an Error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject("boom")),
    );

    const { jobId: id } = service.createJob(urls(1));
    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    expect(service.getJob(id).results[0]?.error).toBe("boom");
  });

  it("falls back to the outer message when the cause carries none", async () => {
    const failure = new TypeError("fetch failed");
    failure.cause = new Error("");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(failure)),
    );

    const { jobId: id } = service.createJob(urls(1));
    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    expect(service.getJob(id).results[0]?.error).toBe("fetch failed");
  });

  it("records a timed-out check as an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.reject(
          new DOMException("The operation was aborted due to timeout", "TimeoutError"),
        ),
      ),
    );

    const { jobId: id } = service.createJob(urls(1));
    await waitFor(() => expect(service.getJob(id).status).toBe("failed"));

    expect(service.getJob(id).results[0]).toMatchObject({
      status: "error",
      error: "The operation was aborted due to timeout",
      httpStatus: undefined,
    });
  });

  it("keeps results in submission order however the responses interleave", async () => {
    const stub = blockingFetch();

    const { jobId: id } = service.createJob(urls(3));
    await tick();

    const [first, second, third] = stub.releases;
    third?.(new Response(null, { status: 503 }));
    await tick();
    second?.(new Response(null, { status: 201 }));
    first?.(new Response(null, { status: 200 }));

    await waitFor(() => expect(service.getJob(id).status).toBe("completed"));
    expect(service.getJob(id).results.map(({ httpStatus }) => httpStatus)).toEqual([200, 201, 503]);
  });

  it("lists every job in creation order and leaves them independent", async () => {
    const stub = blockingFetch();

    const first = service.createJob(urls(1));
    const second = service.createJob(urls(2));

    expect(service.getJobs().jobs.map(({ jobId }) => jobId)).toEqual([first.jobId, second.jobId]);
    expect(first.jobId).not.toBe(second.jobId);

    service.cancelJob(first.jobId);
    stub.releaseAll();
    await waitFor(() => expect(service.getJob(second.jobId).status).toBe("completed"));

    // Cancelling one job must not abort the other's in-flight work.
    expect(service.getJob(first.jobId).status).toBe("cancelled");
    expect(service.getJobs().jobs.map(({ totalUrls }) => totalUrls)).toEqual([1, 2]);
  });

  it("returns an empty list when nothing has been submitted", () => {
    expect(service.getJobs()).toEqual({ jobs: [] });
  });

  it("counts URL statuses in canonical order and omits the empty ones", async () => {
    const stub = blockingFetch();

    service.createJob(urls(12));
    await tick();

    // Finishing one URL frees a worker, which immediately claims the next queued URL.
    stub.releases.splice(0, 1)[0]?.(new Response(null, { status: 200 }));
    await tick();

    expect(service.getJobs().jobs[0]?.urlStatuses).toEqual([
      { key: "pending", value: 6 },
      { key: "in_progress", value: 5 },
      { key: "success", value: 1 },
    ]);
  });

  it("stays cancelled when cancelled twice", () => {
    blockingFetch();

    const { jobId: id } = service.createJob(urls(4));
    service.cancelJob(id);
    const again = service.cancelJob(id);

    expect(again.status).toBe("cancelled");
    expect(again.results.every(({ status }) => status === "cancelled")).toBe(true);
  });

  it("cancels URLs that were claimed before the first tick", async () => {
    const stub = blockingFetch();

    // runJob claims the first five URLs synchronously, so a cancel with no await in
    // between still has in-flight requests to abort.
    const { jobId: id } = service.createJob(urls(6));
    const cancelled = service.cancelJob(id);

    expect(stub.impl).toHaveBeenCalledTimes(5);
    expect(cancelled.results.every(({ status }) => status === "cancelled")).toBe(true);

    stub.releaseAll();
    await tick();

    expect(stub.impl).toHaveBeenCalledTimes(5);
  });

  it("marks a finished job cancelled but keeps its recorded results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );

    const { jobId: id } = service.createJob(urls(2));
    await waitFor(() => expect(service.getJob(id).status).toBe("completed"));

    const cancelled = service.cancelJob(id);

    // Deleting a job that has already run only flips the job status; per-URL outcomes stand.
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.results.map(({ status }) => status)).toEqual(["success", "success"]);
  });

  it("leaves a job with no URLs pending", async () => {
    const created = service.createJob([]);
    await tick();

    // CreateJobRequestDto rejects an empty list at the edge, so this state is not
    // reachable over HTTP; the service itself has no terminal state for it.
    expect(created.urls).toEqual([]);
    expect(service.getJob(created.jobId).results).toEqual([]);
    expect(service.getJob(created.jobId).status).toBe("pending");
    expect(service.getJobs().jobs[0]).toMatchObject({ totalUrls: 0, urlStatuses: [] });
  });
});
