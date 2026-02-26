"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const config_1 = require("../config");
const router = (0, express_1.Router)();
router.get("/app-config", (_req, res) => {
    res.json({
        productOptions: config_1.PRODUCT_OPTIONS,
        pages: ["Interview analyser", "Drilldown", "Assessments", "Assignments"],
        interviewModules: ["Interview_analyser", "Video_uploader"],
        appName: "",
        version: "Integrated Pipeline v2.0",
    });
});
exports.default = router;
