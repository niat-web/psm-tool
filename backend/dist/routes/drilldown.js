"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drilldownService_1 = require("../services/drilldownService");
const jobManager_1 = require("../utils/jobManager");
const router = (0, express_1.Router)();
router.get("/sample-template", (_req, res) => {
    const csv = (0, drilldownService_1.getDrilldownSampleCsv)();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=drilldown_template.csv");
    res.send(csv);
});
router.post("/analyze", async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const product = String(req.body?.product ?? "N/A");
        const result = await (0, drilldownService_1.analyzeDrilldownRows)(rows, product);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/analyze/start", async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const product = String(req.body?.product ?? "N/A");
        const job = (0, jobManager_1.createJob)(async (update, control) => (0, drilldownService_1.analyzeDrilldownRows)(rows, product, update, control.throwIfCancelled));
        res.json({ jobId: job.id });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
