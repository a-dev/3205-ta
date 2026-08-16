import { useEffect } from "react";

import { JobDetails } from "@/features/job-details/job-details";
import { JobForm } from "@/features/job-form/job-form";
import { JobList } from "@/features/job-list/job-list";
import { useJobsStore } from "@/shared/store";

import styles from "./jobs-page.module.css";

export function JobsPage() {
  const loadJobs = useJobsStore((state) => state.loadJobs);
  const stopPolling = useJobsStore((state) => state.stopPolling);
  const jobsLoading = useJobsStore((state) => state.jobsLoading);
  const jobs = useJobsStore((state) => state.jobs);

  useEffect(() => {
    loadJobs();

    return stopPolling; // remove polling
  }, [loadJobs, stopPolling]);

  return (
    <main className={styles.root}>
      <JobForm />
      {jobsLoading && <div>Loading...</div>}

      {jobs.length === 0 ? null : (
        <div className={styles.jobs}>
          <h2 className={styles.heading}>джобы</h2>
          <div className={styles.columns}>
            <JobList />
            <JobDetails />
          </div>
        </div>
      )}
    </main>
  );
}
