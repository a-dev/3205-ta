import { create } from "zustand";

import type { JobDetails, JobSummary } from "@/shared/api/types";

import { cancelJob as cancelJobRequest } from "@/shared/api/cancel-job.mutation";
import { ApiError, isAbortError, toErrorMessage } from "@/shared/api/client";
import { isJobStatusStopPulling } from "@/shared/api/lib";
import { createJob as createJobRequest } from "@/shared/api/create-job.mutation";
import { getJob } from "@/shared/api/get-job.query";
import { getJobs } from "@/shared/api/get-jobs.query";

const POLL_INTERVAL_MS = 1000;

type JobsState = {
  jobs: JobSummary[];
  jobsLoading: boolean;
  jobsError: string | null;

  activeJobId: string | null;

  details: JobDetails | null;
  detailsLoading: boolean;

  creating: boolean;
  createError: string | null;

  cancelling: boolean;
  cancelError: string | null;
};

type JobsActions = {
  loadJobs: () => Promise<void>;
  createJob: (urls: string[]) => Promise<string | null>;
  selectJob: (jobId: string | null) => void;
  cancelActiveJob: () => Promise<void>;
  stopPolling: () => void;
};

export type JobsStore = JobsState & JobsActions;

export const useJobsStore = create<JobsStore>()((set, get) => {
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let pollAbort: AbortController | null = null;

  async function poll(jobId: string): Promise<void> {
    pollAbort = new AbortController();

    try {
      const details = await getJob(jobId, pollAbort.signal);

      if (get().activeJobId !== jobId) return;

      set({ details, detailsLoading: false });

      if (isJobStatusStopPulling(details.status)) {
        stopPolling();
        get().loadJobs();
        return;
      }
    } catch (error) {
      if (isAbortError(error) || get().activeJobId !== jobId) return;

      set({ detailsLoading: false });

      if (error instanceof ApiError && error.status === 404) {
        stopPolling();
        return;
      }
    }

    pollTimer = setTimeout(() => poll(jobId), POLL_INTERVAL_MS);
  }

  function stopPolling(): void {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }

    pollAbort?.abort();
    pollAbort = null;
  }

  return {
    jobs: [],
    jobsLoading: false,
    jobsError: null,

    activeJobId: null,

    details: null,
    detailsLoading: false,

    creating: false,
    createError: null,

    cancelling: false,
    cancelError: null,

    loadJobs: async () => {
      set({ jobsLoading: true, jobsError: null });

      try {
        const jobs = await getJobs();
        set({ jobs, jobsLoading: false });
      } catch (error) {
        set({ jobsLoading: false, jobsError: toErrorMessage(error) });
      }
    },

    createJob: async (urls) => {
      set({ creating: true, createError: null });

      try {
        const { jobId } = await createJobRequest(urls);

        set({ creating: false });
        get().loadJobs();
        get().selectJob(jobId);

        return jobId;
      } catch (error) {
        set({ creating: false, createError: toErrorMessage(error) });

        return null;
      }
    },

    selectJob: (jobId) => {
      if (get().activeJobId === jobId) return;

      stopPolling();

      set({
        activeJobId: jobId,
        details: null,
        detailsLoading: jobId !== null,
        cancelError: null,
      });

      if (jobId !== null) poll(jobId);
    },

    cancelActiveJob: async () => {
      const jobId = get().activeJobId;
      if (jobId === null || get().cancelling) return;

      set({ cancelling: true, cancelError: null });

      try {
        const details = await cancelJobRequest(jobId);
        stopPolling();

        set({ cancelling: false, details, detailsLoading: false });
        get().loadJobs();
      } catch (error) {
        set({ cancelling: false, cancelError: toErrorMessage(error) });
      }
    },

    stopPolling,
  };
});
