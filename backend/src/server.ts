import "dotenv/config";
import express from "express";
import cors from "cors";
import metaRoutes from "./routes/meta";
import drilldownRoutes from "./routes/drilldown";
import assignmentsRoutes from "./routes/assignments";
import assessmentsRoutes from "./routes/assessments";
import interviewRoutes from "./routes/interview";
import jobsRoutes from "./routes/jobs";

const app = express();

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api", metaRoutes);
app.use("/api/drilldown", drilldownRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/jobs", jobsRoutes);

const port = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${port}`);
});
