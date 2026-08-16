import { useState, type SyntheticEvent } from "react";

import { useJobsStore } from "@/shared/store";

import styles from "./job-form.module.css";

// One URL per line, trimmed, blanks dropped
function parseUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function findInvalidUrls(urls: string[]): string[] {
  // check if it is a URL with http or https scheme
  // URL.parse is in the baseline
  return urls.filter((url) => {
    const parsed = URL.parse(url);
    return parsed?.protocol !== "http:" && parsed?.protocol !== "https:";
  });
}

export function JobForm() {
  const [text, setText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const creating = useJobsStore((state) => state.creating);
  const createError = useJobsStore((state) => state.createError);
  const createJob = useJobsStore((state) => state.createJob);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const urls = parseUrls(text);

    if (urls.length === 0) {
      setInputError("Add at least one URL");
      return;
    }

    const invalid = findInvalidUrls(urls);

    if (invalid.length > 0) {
      setInputError(`Invalid URLs: ${invalid.join(", ")}`);
      return;
    } else {
      setInputError(null);
    }

    if ((await createJob(urls)) !== null) setText("");
  }

  return (
    <form onSubmit={(event) => handleSubmit(event)} className={styles.root}>
      <label htmlFor="urls">Enter one URL per line</label>
      <textarea
        id="urls"
        rows={6}
        value={text}
        disabled={creating}
        onChange={(event) => setText(event.target.value)}
        placeholder={"https://wikipedia.org\nhttps://google.com"}
        className={styles.textarea}
      />
      <button type="submit" disabled={creating || text.trim() === ""} className={styles.submit}>
        {creating ? "Starting..." : "Start Job"}
      </button>
      {inputError !== null && <div className={styles.error}>{inputError}</div>}
      {createError !== null && <div className={styles.error}>{createError}</div>}
    </form>
  );
}
