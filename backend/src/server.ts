import "dotenv/config";
import express from "express";
import cors from "cors";
import metaRoutes from "./routes/meta";
import drilldownRoutes from "./routes/drilldown";
import assignmentsRoutes from "./routes/assignments";
import assessmentsRoutes from "./routes/assessments";
import interviewRoutes from "./routes/interview";
import jobsRoutes from "./routes/jobs";
import settingsRoutes from "./routes/settings";

const app = express();
const apiBodyLimit = process.env.API_BODY_LIMIT ?? "200mb";

app.use(cors());
app.use(express.json({ limit: apiBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: apiBodyLimit }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api", metaRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/drilldown", drilldownRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/assessments", assessmentsRoutes);
app.use("/api/interview", interviewRoutes);
app.use("/api/jobs", jobsRoutes);

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.status === 413 || error?.type === "entity.too.large") {
    res.status(413).json({
      error: `Request payload too large. Current API_BODY_LIMIT=${apiBodyLimit}.`,
    });
    return;
  }

  next(error);
});

const port = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 4000);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${port}`);
});
