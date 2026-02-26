"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelJob = exports.getJob = exports.createJob = exports.JobCancelledError = void 0;
const node_crypto_1 = require("node:crypto");
class JobCancelledError extends Error {
    constructor(message = "Cancelled by user.") {
        super(message);
        this.name = "JobCancelledError";
    }
}
exports.JobCancelledError = JobCancelledError;
const jobs = new Map();
const JOB_TTL_MS = 1000 * 60 * 30;
const nowIso = () => new Date().toISOString();
const isTerminalState = (state) => state === "success" || state === "error" || state === "cancelled";
const cleanupExpiredJobs = () => {
    const now = Date.now();
    for (const [id, job] of jobs.entries()) {
        const updatedAtMs = new Date(job.updatedAt).getTime();
        if (Number.isFinite(updatedAtMs) && now - updatedAtMs > JOB_TTL_MS) {
            jobs.delete(id);
        }
    }
};
const createJob = (runner) => {
    cleanupExpiredJobs();
    const id = (0, node_crypto_1.randomUUID)();
    const initial = {
        id,
        state: "queued",
        message: "Queued...",
        cancelRequested: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };
    jobs.set(id, initial);
    const update = (message, payload) => {
        const current = jobs.get(id);
        if (!current)
            return;
        if (current.state === "cancelled")
            return;
        current.message = message;
        if (payload?.partialResult !== undefined) {
            current.partialResult = payload.partialResult;
        }
        if (payload && "progress" in payload) {
            current.progress = payload.progress ?? undefined;
        }
        else {
            current.progress = undefined;
        }
        current.updatedAt = nowIso();
        if (current.state === "queued") {
            current.state = "running";
        }
    };
    const control = {
        isCancelled: () => {
            const current = jobs.get(id);
            return current?.cancelRequested === true || current?.state === "cancelled";
        },
        throwIfCancelled: () => {
            if (control.isCancelled()) {
                throw new JobCancelledError();
            }
        },
    };
    void (async () => {
        const current = jobs.get(id);
        if (!current)
            return;
        if (current.cancelRequested) {
            current.state = "cancelled";
            current.message = "Cancelled by user.";
            current.progress = undefined;
            current.updatedAt = nowIso();
            return;
        }
        current.state = "running";
        current.message = "Started...";
        current.progress = undefined;
        current.updatedAt = nowIso();
        try {
            const result = await runner(update, control);
            const done = jobs.get(id);
            if (!done)
                return;
            if (done.cancelRequested || done.state === "cancelled") {
                done.state = "cancelled";
                done.message = "Cancelled by user.";
                done.progress = undefined;
                done.updatedAt = nowIso();
                return;
            }
            done.state = "success";
            done.result = result;
            done.partialResult = result;
            done.message = "Completed.";
            done.progress = undefined;
            done.updatedAt = nowIso();
        }
        catch (error) {
            const failed = jobs.get(id);
            if (!failed)
                return;
            if (failed.cancelRequested || failed.state === "cancelled" || error instanceof JobCancelledError) {
                failed.state = "cancelled";
                failed.message = "Cancelled by user.";
                failed.progress = undefined;
                failed.updatedAt = nowIso();
                return;
            }
            failed.state = "error";
            failed.error = String(error);
            failed.message = failed.error;
            failed.progress = undefined;
            failed.updatedAt = nowIso();
        }
    })();
    return initial;
};
exports.createJob = createJob;
const getJob = (id) => {
    cleanupExpiredJobs();
    return jobs.get(id) ?? null;
};
exports.getJob = getJob;
const cancelJob = (id) => {
    cleanupExpiredJobs();
    const job = jobs.get(id);
    if (!job)
        return null;
    if (isTerminalState(job.state)) {
        return job;
    }
    job.cancelRequested = true;
    job.state = "cancelled";
    job.message = "Cancelled by user.";
    job.progress = undefined;
    job.updatedAt = nowIso();
    return job;
};
exports.cancelJob = cancelJob;
