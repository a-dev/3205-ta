import type { JobSummary } from "@/shared/api/types";

import styles from "./job.module.css";

type JobProps = {
  job: JobSummary;
  selected: boolean;
  onSelect: (jobId: string) => void;
};

export function Job({ job, selected, onSelect }: JobProps) {
  return (
    <li className={styles.root}>
      💼
      <button
        className={styles.button}
        type="button"
        onClick={() => onSelect(job.jobId)}
        disabled={selected}
      >
        <div className={styles.header}>
          <strong className={styles.counter}>{job.totalUrls} URLs</strong>,{" "}
          <span className={styles.date}>{new Date(job.createdAt).toLocaleString()}</span>{" "}
          <span className={styles.status}>{job.status}</span>
        </div>
        <div className={styles.statuses}>
          {job.urlStatuses.map(({ key, value }) => `${key}: ${value}`).join(", ")}
        </div>
      </button>
    </li>
  );
}
