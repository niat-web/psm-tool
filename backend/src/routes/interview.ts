import { Router } from "express";
import multer from "multer";
import { runInterviewAnalyzer, runVideoUploader } from "../services/interviewService";
import { createJob } from "../utils/jobManager";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/analyzer", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const product = String(req.body?.product ?? "N/A");

    const result = await runInterviewAnalyzer({ rows, product });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

router.post("/analyzer/start", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const product = String(req.body?.product ?? "N/A");

    const job = createJob(async (update, control) =>
      runInterviewAnalyzer({
        rows,
        product,
        onStatus: update,
        abortIfCancelled: control.throwIfCancelled,
      }),
    );

    res.json({ jobId: job.id });
  } catch (error) {
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

    const result = await runVideoUploader({
      metadata,
      uploadedFile: req.file,
      product,
    });

    res.json(result);
  } catch (error) {
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
    const job = createJob(async (update, control) =>
      runVideoUploader({
        metadata,
        uploadedFile,
        product,
        onStatus: update,
        abortIfCancelled: control.throwIfCancelled,
      }),
    );

    res.json({ jobId: job.id });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

export default router;
