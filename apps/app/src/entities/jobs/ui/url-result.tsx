import type { UrlResult } from "@/shared/api/types";

import styles from "./url-result.module.css";

type UrlResultProps = {
  result: UrlResult;
};

export function UrlResult({ result }: UrlResultProps) {
  return (
    <dl className={styles.root}>
      <dt>URL</dt>
      <dd className={styles.url}>{result.url}</dd>
      <dt>Status</dt>
      <dd>{result.status === "in_progress" ? "in_progress..." : result.status}</dd>
      {Boolean(result.httpStatus) && (
        <>
          <dt>HTTP</dt>
          <dd>{result.httpStatus ?? "—"}</dd>
        </>
      )}
      {result.status === "error" && (
        <>
          <dt>Error</dt>
          <dd>{result.error ?? "—"}</dd>
        </>
      )}
      {result.status === "success" && Boolean(result.durationMs) && (
        <>
          <dt>Duration</dt>
          <dd>{result.durationMs} ms</dd>
        </>
      )}
    </dl>
  );
}
