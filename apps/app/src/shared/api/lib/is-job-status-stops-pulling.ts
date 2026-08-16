import { STOP_PULLING_JOB_STATUSES } from "../constants";

export function isJobStatusStopPulling(status: string): boolean {
  return (STOP_PULLING_JOB_STATUSES as readonly string[]).includes(status);
}
