"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jobManager_1 = require("../utils/jobManager");
const router = (0, express_1.Router)();
router.get("/:id", (req, res) => {
    const jobId = String(req.params.id ?? "").trim();
    if (!jobId) {
        res.status(400).json({ error: "Missing job id." });
        return;
    }
    const job = (0, jobManager_1.getJob)(jobId);
    if (!job) {
        res.status(404).json({ error: "Job not found." });
        return;
    }
    res.json(job);
});
router.post("/:id/cancel", (req, res) => {
    const jobId = String(req.params.id ?? "").trim();
    if (!jobId) {
        res.status(400).json({ error: "Missing job id." });
        return;
    }
    const cancelled = (0, jobManager_1.cancelJob)(jobId);
    if (!cancelled) {
        res.status(404).json({ error: "Job not found." });
        return;
    }
    res.json(cancelled);
});
exports.default = router;
