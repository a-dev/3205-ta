import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";

import { AppModule } from "../src/app.module.js";
import { setupApp } from "../src/app.setup.js";

// Keep the artificial 0-10s per-URL delay out of the HTTP tests.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, randomInt: () => 0 };
});

const UNKNOWN_JOB_ID = "6ad2b5f4-9e0d-4f1b-9d4e-6f0f6a9f0a11";
const UUID_V1 = "6ad2b5f4-9e0d-1f1b-9d4e-6f0f6a9f0a11";

describe("Jobs (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    // No URL is ever really contacted; every check resolves as reachable.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
    );

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = setupApp(module.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function api() {
    return request(app.getHttpServer());
  }

  async function createJob(urls = ["https://example.com/health"]): Promise<string> {
    const { body } = await api().post("/api/jobs").send({ urls }).expect(202);
    return body.jobId as string;
  }

  it("serves the health route behind the /api prefix", async () => {
    await api().get("/api").expect(200, "OK!");
    await api().get("/").expect(404);
  });

  it("accepts a job with 202 and reports it as pending", async () => {
    const { body } = await api()
      .post("/api/jobs")
      .send({ urls: ["https://example.com/a", "http://example.com/b"] })
      .expect(202);

    expect(body).toEqual({
      jobId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      urls: ["https://example.com/a", "http://example.com/b"],
      createdAt: expect.any(String),
      status: "pending",
    });
    expect(new Date(body.createdAt as string).toISOString()).toBe(body.createdAt);
  });

  it.each([
    ["an empty URL list", { urls: [] }],
    ["a missing URL list", {}],
    ["a URL list that is not an array", { urls: "https://example.com" }],
    ["a URL without a protocol", { urls: ["example.com"] }],
    ["a non-HTTP protocol", { urls: ["ftp://example.com"] }],
    ["one bad URL among good ones", { urls: ["https://example.com", "nope"] }],
    ["an undeclared property", { urls: ["https://example.com"], callbackUrl: "https://evil.test" }],
  ])("rejects %s with 400", async (_case, payload) => {
    await api().post("/api/jobs").send(payload).expect(400);
  });

  it("returns the job and its per-URL results", async () => {
    const jobId = await createJob(["https://example.com/a"]);

    const { body } = await api().get(`/api/jobs/${jobId}`).expect(200);

    expect(body).toMatchObject({ jobId, status: expect.any(String) });
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      url: "https://example.com/a",
    });
  });

  it("lists submitted jobs with their URL counts", async () => {
    const first = await createJob(["https://example.com/a"]);
    const second = await createJob(["https://example.com/b", "https://example.com/c"]);

    const { body } = await api().get("/api/jobs").expect(200);

    expect(body.jobs.map((job: { jobId: string }) => job.jobId)).toEqual([first, second]);
    expect(body.jobs.map((job: { totalUrls: number }) => job.totalUrls)).toEqual([1, 2]);
  });

  it("cancels a job through DELETE and keeps returning it afterwards", async () => {
    const jobId = await createJob(["https://example.com/a"]);

    const { body } = await api().delete(`/api/jobs/${jobId}`).expect(200);
    expect(body).toMatchObject({ jobId, status: "cancelled" });

    // Cancelling marks the job; it does not remove it from the store.
    await api().get(`/api/jobs/${jobId}`).expect(200);
    await api().delete(`/api/jobs/${jobId}`).expect(200);
  });

  it.each([
    ["not-a-uuid", "a malformed id"],
    [UUID_V1, "a UUID that is not version 4"],
  ])("rejects %s with 400 (%s)", async (id) => {
    await api().get(`/api/jobs/${id}`).expect(400);
    await api().delete(`/api/jobs/${id}`).expect(400);
  });

  it("answers 404 for a well-formed id that no job uses", async () => {
    await api().get(`/api/jobs/${UNKNOWN_JOB_ID}`).expect(404);
    await api().delete(`/api/jobs/${UNKNOWN_JOB_ID}`).expect(404);
  });
});
