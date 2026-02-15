import { Router } from "express";
import { PRODUCT_OPTIONS } from "../config";

const router = Router();

router.get("/app-config", (_req, res) => {
  res.json({
    productOptions: PRODUCT_OPTIONS,
    pages: ["Interview analyser", "Drilldown", "Assessments", "Assignments"],
    interviewModules: ["Interview_analyser", "Video_uploader"],
    appName: "Integrated Analyst Tool",
    version: "Integrated Pipeline v2.0",
  });
});

export default router;
