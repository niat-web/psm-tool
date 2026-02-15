import { fetchJobStatus } from "../api/client";
import type { ApiResult, JobStatusResponse } from "../types";

export class PollingAbortedError extends Error {
  constructor(message = "Polling aborted.") {
    super(message);
    this.name = "PollingAbortedError";
  }
}

export class JobCancelledByUserError extends Error {
  constructor(message = "Job cancelled by user.") {
    super(message);
    this.name = "JobCancelledByUserError";
  }
}

export const isPollingAbortedError = (error: unknown): boolean =>
  error instanceof PollingAbortedError;

export const isJobCancelledByUserError = (error: unknown): boolean =>
  error instanceof JobCancelledByUserError;

const throwIfAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted) {
    throw new PollingAbortedError();
  }
};

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(new PollingAbortedError());
    };

    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      resolve();
    }, ms);

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeout);
        reject(new PollingAbortedError());
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });

export const waitForJobCompletion = async (
  jobId: string,
  onUpdate: (status: JobStatusResponse) => void,
  pollIntervalMs = 1200,
  options?: { signal?: AbortSignal },
): Promise<ApiResult> => {
  for (;;) {
    throwIfAborted(options?.signal);
    const status = await fetchJobStatus(jobId);
    onUpdate(status);

    if (status.state === "success") {
      if (!status.result) {
        throw new Error("Job completed without result.");
      }
      return status.result;
    }

    if (status.state === "error") {
      throw new Error(status.error || status.message || "Job failed.");
    }

    if (status.state === "cancelled") {
      throw new JobCancelledByUserError(status.message || "Job cancelled by user.");
    }

    await sleep(pollIntervalMs, options?.signal);
  }
};
