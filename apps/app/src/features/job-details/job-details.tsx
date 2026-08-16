import { UrlResult } from "@/entities/jobs";
import { isJobStatusStopPulling } from "@/shared/api/lib";
import { useJobsStore } from "@/shared/store";

import styles from "./job-detail.module.css";

export function JobDetails() {
  const activeJobId = useJobsStore((state) => state.activeJobId);
  const details = useJobsStore((state) => state.details);
  const detailsLoading = useJobsStore((state) => state.detailsLoading);
  const cancelling = useJobsStore((state) => state.cancelling);
  const cancelError = useJobsStore((state) => state.cancelError);
  const cancelActiveJob = useJobsStore((state) => state.cancelActiveJob);

  if (activeJobId === null) return <section className={styles.root}>Select a job</section>;
  if (detailsLoading) return <section className={styles.root}>Loading...</section>;
  if (details === null) return <section className={styles.root}>There are no URLs</section>;

  const stopPulling = isJobStatusStopPulling(details.status);

  return (
    <section className={styles.root}>
      <div className={styles.status}>
        Status: {details.status}
        <div className={styles.loader}>{!stopPulling && "checking..."}</div>
      </div>

      {!stopPulling && (
        <button
          type="button"
          onClick={() => cancelActiveJob()}
          disabled={cancelling}
          className={styles.cancel}
        >
          {cancelling ? "Cancelling..." : "Cancel job"}
        </button>
      )}
      {cancelError !== null && <p>{cancelError}</p>}
      <div className={styles.results}>
        {details.results.map((result) => (
          <UrlResult key={result.id} result={result} />
        ))}
      </div>
    </section>
  );
}
