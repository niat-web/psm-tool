"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeAssignments = void 0;
const node_crypto_1 = require("node:crypto");
const curriculum_1 = require("../utils/curriculum");
const enum_1 = require("../utils/enum");
const google_1 = require("../utils/google");
const mistral_1 = require("../utils/mistral");
const contentExtraction_1 = require("../utils/contentExtraction");
const config_1 = require("../config");
const SHEET_HEADERS = [
    "job_id",
    "company_name",
    "question_text",
    "question_type",
    "tech_stacks",
    "difficulty_level",
    "curriculum_coverage",
    "question_uid",
    "assignment_date",
    "question_creation_datetime",
    "assignment_link",
    "product",
];
const nowDate = () => new Date().toISOString().slice(0, 10);
const nowDateTime = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const buildSystemPrompt = async () => {
    const curriculum = await (0, curriculum_1.getCurriculumSnippet)(10000);
    return `
You are an expert Senior Technical Curriculum Architect. 
Your task is to analyze assignment descriptions and extract structured metadata.

CURRICULUM CONTEXT:
${curriculum}

OUTPUT FORMAT: JSON Object ONLY.

FIELDS TO EXTRACT:
1. "question_text": 
   - A professional executive summary (2-4 sentences) of WHAT needs to be built.

2. "tech_stacks": 
   - LIST the required technologies.
   - Map to: [JAVA, PYTHON, JAVASCRIPT, HTML, CSS, SQL, REACT_JS, NODE_JS, EXPRESS_JS, SPRING_BOOT, DSA, SYSTEM_DESIGN, WEB_DEVELOPMENT, CLOUD_COMPUTING, DATA_SCIENCE].
   - Fallback: GENERAL.

3. "difficulty_level": 
   - EASY | MEDIUM | HARD based on complexity.

4. "question_type":
   - CODING | PROJECT | ASSIGNMENT | CASE_STUDY.
   - Default: ASSIGNMENT.

5. "curriculum_coverage":
   - COVERED | NOT_COVERED | N/A.
   - Check against CURRICULUM CONTEXT.
`;
};
const runMistralAssignmentAnalysis = async (systemPrompt, content) => {
    if (!content || content.length < 50 || content.startsWith("Error")) {
        return null;
    }
    const cleanContent = content.slice(0, 20000);
    const userPrompt = `Analyze this assignment text:\n---\n${cleanContent}\n---`;
    try {
        const parsed = await (0, mistral_1.mistralChatJson)([
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ], { responseAsJsonObject: true, temperature: 0.1, timeoutMs: 60000 });
        if (typeof parsed === "object" && parsed !== null) {
            return parsed;
        }
        return null;
    }
    catch {
        return null;
    }
};
const analyzeAssignments = async (rows, product, onStatus, abortIfCancelled) => {
    abortIfCancelled?.();
    onStatus?.("Loading curriculum context...");
    const systemPrompt = await buildSystemPrompt();
    abortIfCancelled?.();
    const finalRows = [];
    const totalRows = rows.length;
    let currentRow = 0;
    for (const row of rows) {
        abortIfCancelled?.();
        currentRow += 1;
        const link = String(row.assignment_link ?? "").trim();
        if (!link)
            continue;
        const jobId = String(row.job_id ?? "").trim();
        const company = String(row.company_name ?? "Unknown").trim();
        const assignmentDate = String(row.assignment_date ?? nowDate()).trim() || nowDate();
        onStatus?.(`Fetching assignment content ${currentRow}/${totalRows}...`);
        const extractedText = await (0, contentExtraction_1.smartFetchContent)(link);
        abortIfCancelled?.();
        onStatus?.(`Analyzing assignment ${currentRow}/${totalRows}...`);
        const analysis = await runMistralAssignmentAnalysis(systemPrompt, extractedText);
        abortIfCancelled?.();
        let questionText = "FAILED: Content empty or unrecognizable";
        let questionType = "ASSIGNMENT";
        let techStacks = "GENERAL";
        let difficultyLevel = "MEDIUM";
        let curriculumCoverage = "N/A";
        if (analysis) {
            questionText = String(analysis.question_text ?? questionText);
            questionType = String(analysis.question_type ?? questionType);
            techStacks = analysis.tech_stacks ?? techStacks;
            difficultyLevel = analysis.difficulty_level ?? difficultyLevel;
            curriculumCoverage = analysis.curriculum_coverage ?? curriculumCoverage;
        }
        else if (extractedText.startsWith("Error")) {
            questionText = `FAILED: ${extractedText}`;
        }
        finalRows.push({
            job_id: jobId,
            company_name: company,
            question_text: questionText,
            question_type: (0, enum_1.forceEnumFormat)(questionType),
            tech_stacks: (0, enum_1.forceEnumFormat)(techStacks),
            difficulty_level: (0, enum_1.forceEnumFormat)(difficultyLevel),
            curriculum_coverage: (0, enum_1.forceEnumFormat)(curriculumCoverage),
            question_uid: (0, node_crypto_1.randomUUID)().replace(/-/g, ""),
            assignment_date: assignmentDate,
            question_creation_datetime: nowDateTime(),
            assignment_link: link,
            product,
        });
    }
    const orderedRows = finalRows.map((row) => {
        const normalized = {};
        for (const header of SHEET_HEADERS) {
            normalized[header] = row[header] ?? "N/A";
        }
        return normalized;
    });
    abortIfCancelled?.();
    onStatus?.("Saving assignment results to sheet...");
    const savedToSheet = await (0, google_1.appendRowsWithHeaders)({
        sheetName: config_1.SHEET_NAMES.assignments,
        headers: SHEET_HEADERS,
        rows: orderedRows,
    });
    return { rows: orderedRows, savedToSheet };
};
exports.analyzeAssignments = analyzeAssignments;
