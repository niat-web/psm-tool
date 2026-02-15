"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const assessmentsService_1 = require("../services/assessmentsService");
const jobManager_1 = require("../utils/jobManager");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const toFileMap = (files) => {
    const map = new Map();
    for (const file of files ?? []) {
        map.set(file.fieldname, file);
    }
    return map;
};
router.post("/individual", upload.any(), async (req, res) => {
    try {
        const rowsRaw = typeof req.body?.rows === "string" ? req.body.rows : "[]";
        const rows = JSON.parse(rowsRaw);
        const product = String(req.body?.product ?? "N/A");
        const fileMap = toFileMap(req.files);
        const result = await (0, assessmentsService_1.analyzeAssessmentIndividual)({
            rows,
            files: fileMap,
            product,
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/individual/start", upload.any(), async (req, res) => {
    try {
        const rowsRaw = typeof req.body?.rows === "string" ? req.body.rows : "[]";
        const rows = JSON.parse(rowsRaw);
        const product = String(req.body?.product ?? "N/A");
        const fileMap = toFileMap(req.files);
        const job = (0, jobManager_1.createJob)(async (update, control) => (0, assessmentsService_1.analyzeAssessmentIndividual)({
            rows,
            files: fileMap,
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
router.post("/zip", upload.any(), async (req, res) => {
    try {
        const rowsRaw = typeof req.body?.rows === "string" ? req.body.rows : "[]";
        const rows = JSON.parse(rowsRaw);
        const product = String(req.body?.product ?? "N/A");
        const fileMap = toFileMap(req.files);
        const result = await (0, assessmentsService_1.analyzeAssessmentZip)({
            rows,
            files: fileMap,
            product,
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: String(error) });
    }
});
router.post("/zip/start", upload.any(), async (req, res) => {
    try {
        const rowsRaw = typeof req.body?.rows === "string" ? req.body.rows : "[]";
        const rows = JSON.parse(rowsRaw);
        const product = String(req.body?.product ?? "N/A");
        const fileMap = toFileMap(req.files);
        const job = (0, jobManager_1.createJob)(async (update, control) => (0, assessmentsService_1.analyzeAssessmentZip)({
            rows,
            files: fileMap,
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
