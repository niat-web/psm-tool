import { Router } from "express";
import { analyzeAssignments } from "../services/assignmentsService";
import { createJob } from "../utils/jobManager";

const router = Router();

router.post("/analyze", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const product = String(req.body?.product ?? "N/A");

    const result = await analyzeAssignments(rows, product);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/analyze/start", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const product = String(req.body?.product ?? "N/A");

    const job = createJob(async (update, control) =>
      analyzeAssignments(rows, product, update, control.throwIfCancelled),
    );

    res.json({ jobId: job.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
