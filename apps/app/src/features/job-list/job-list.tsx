import { Job } from "@/entities/jobs";
import { useJobsStore } from "@/shared/store";

import styles from "./job-list.module.css";

export function JobList() {
  const jobs = useJobsStore((state) => state.jobs);
  const jobsError = useJobsStore((state) => state.jobsError);
  const jobsLoading = useJobsStore((state) => state.jobsLoading);
  const activeJobId = useJobsStore((state) => state.activeJobId);
  const loadJobs = useJobsStore((state) => state.loadJobs);
  const selectJob = useJobsStore((state) => state.selectJob);

  return (
    <section className={styles.root}>
      {jobsError !== null && (
        <div className={styles.error}>
          <div>{jobsError}</div>
          <button
            type="button"
            onClick={() => loadJobs()}
            disabled={jobsLoading}
            className={styles.retry}
          >
            Retry
          </button>
        </div>
      )}

      <ul className={styles.list}>
        {jobs.map((job) => (
          <Job
            key={job.jobId}
            job={job}
            selected={job.jobId === activeJobId}
            onSelect={selectJob}
          />
        ))}
      </ul>
    </section>
  );
}
