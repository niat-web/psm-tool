"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const interviewService_1 = require("../services/interviewService");
const jobManager_1 = require("../utils/jobManager");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
router.post("/analyzer", async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const product = String(req.body?.product ?? "N/A");
        const result = await (0, interviewService_1.runInterviewAnalyzer)({ rows, product });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/analyzer/start", async (req, res) => {
    try {
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
        const product = String(req.body?.product ?? "N/A");
        const job = (0, jobManager_1.createJob)(async (update, control) => (0, interviewService_1.runInterviewAnalyzer)({
            rows,
            product,
            onStatus: update,
            abortIfCancelled: control.throwIfCancelled,
        }));
        res.json({ jobId: job.id });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/video-uploader", upload.single("video"), async (req, res) => {
    try {
        const metadataRaw = typeof req.body?.metadata === "string" ? req.body.metadata : "{}";
        const metadata = JSON.parse(metadataRaw);
        const product = String(req.body?.product ?? "N/A");
        if (!req.file) {
            res.status(400).json({ error: "Missing uploaded file." });
            return;
        }
        const result = await (0, interviewService_1.runVideoUploader)({
            metadata,
            uploadedFile: req.file,
            product,
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/video-uploader/start", upload.single("video"), async (req, res) => {
    try {
        const metadataRaw = typeof req.body?.metadata === "string" ? req.body.metadata : "{}";
        const metadata = JSON.parse(metadataRaw);
        const product = String(req.body?.product ?? "N/A");
        if (!req.file) {
            res.status(400).json({ error: "Missing uploaded file." });
            return;
        }
        const uploadedFile = req.file;
        const job = (0, jobManager_1.createJob)(async (update, control) => (0, interviewService_1.runVideoUploader)({
            metadata,
            uploadedFile,
            product,
            onStatus: update,
            abortIfCancelled: control.throwIfCancelled,
        }));
        res.json({ jobId: job.id });
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
exports.default = router;
