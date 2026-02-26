"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const meta_1 = __importDefault(require("./routes/meta"));
const drilldown_1 = __importDefault(require("./routes/drilldown"));
const assignments_1 = __importDefault(require("./routes/assignments"));
const assessments_1 = __importDefault(require("./routes/assessments"));
const interview_1 = __importDefault(require("./routes/interview"));
const jobs_1 = __importDefault(require("./routes/jobs"));
const app = (0, express_1.default)();
const apiBodyLimit = process.env.API_BODY_LIMIT ?? "200mb";
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: apiBodyLimit }));
app.use(express_1.default.urlencoded({ extended: true, limit: apiBodyLimit }));
app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
app.use("/api", meta_1.default);
app.use("/api/drilldown", drilldown_1.default);
app.use("/api/assignments", assignments_1.default);
app.use("/api/assessments", assessments_1.default);
app.use("/api/interview", interview_1.default);
app.use("/api/jobs", jobs_1.default);
app.use((error, _req, res, next) => {
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
