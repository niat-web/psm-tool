"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDrilldownSampleCsv = exports.analyzeDrilldownRows = void 0;
const node_crypto_1 = require("node:crypto");
const curriculum_1 = require("../utils/curriculum");
const enum_1 = require("../utils/enum");
const google_1 = require("../utils/google");
const mistral_1 = require("../utils/mistral");
const config_1 = require("../config");
const DRILLDOWN_PROMPT_TEMPLATE = `
### SYSTEM ROLE
You are a Senior Technical Curriculum Architect and Data Standardizer.
You will receive raw interview notes for one interview round.
Your task is to extract interview questions from the notes, normalize the wording, and enrich each question with standardized metadata.

### INPUT DATA
You will receive one JSON object:
- \`interview_round\` (round name)
- \`round_text\` (raw notes for that round, may be shorthand)

### CURRICULUM CONTEXT
Use the following curriculum text to determine if a topic is covered in the syllabus:
{{CURRICULUM_CONTEXT}}

### CLASSIFICATION RULES

**1. OUTPUT STRUCTURE**
Return a JSON array where EACH item includes the original data plus new fields.
Required fields: \`question_text\`, \`answer_text\`, \`question_type\`, \`question_concept\`, \`difficulty\`, \`topic\`, \`sub_topic\`, \`relevancy_score\`, \`curriculum_coverage\`.

**2. ENUMERATION RULES (Use UPPERCASE_SNAKE_CASE)**

*   **question_type:**
    *   \`CODING\` (Writing code, algorithms, syntax)
    *   \`THEORY\` (Conceptual understanding, definitions)
    *   \`BEHAVIORAL\` (Soft skills, past experiences, situational)
    *   \`SELF_INTRODUCTION\` (Intro, resume walkthrough)
    *   \`PROJECT\` (Discussing specific past projects)
    *   \`GENERAL\` (Any other type)

*   **difficulty:**
    *   \`EASY\` (Basic definitions, recall, standard behavioral questions)
    *   \`MEDIUM\` (Implementation details, comparisons, explaining 'how' or 'why')
    *   \`HARD\` (System design, optimization, edge cases, complex scenarios)

*   **curriculum_coverage:**
    *   \`COVERED\` (The specific concept appears in the provided Curriculum Context)
    *   \`NOT_COVERED\` (The concept is technical but NOT found in the context)
    *   \`N/A\` (For General/Behavioral questions or if context is missing)

*   **relevancy_score:**
    *   A string number from "0" to "10".
    *   \`0-3\`: Irrelevant / Chit-chat.
    *   \`4-7\`: Standard/Generic questions.
    *   \`8-10\`: Deeply technical or highly specific to the job role.

**3. TECH STACK STANDARDIZATION (\`question_concept\`)**
Map the question to the *single best fit* from this list. If it fits multiple, pick the most specific one.
*   **Languages:** JAVA, PYTHON, JAVASCRIPT, C++, C_SHARP, RUST, TYPESCRIPT, HTML, CSS, SQL.
*   **Frameworks/Libs:** REACT_JS, NODE_JS, EXPRESS_JS, NEXT_JS, ANGULAR_JS, SPRING_BOOT, BOOTSTRAP, DJANGO, FLASK.
*   **Core Concepts:** DSA (Data Structures & Algos), OOP (Object Oriented Programming), SYSTEM_DESIGN, DBMS (Databases), OS (Operating Systems), CN (Networks).
*   **Domains:** AI_ML, DATA_SCIENCE, WEB_DEVELOPMENT, CLOUD_COMPUTING, DEVOPS, CYBERSECURITY, BLOCKCHAIN, MOBILE_DEV.
*   **Tools/Process:** GIT, DOCKER, KUBERNETES, AWS, AZURE, SDLC, AGILE, TESTING.
*   **Non-Technical:** APTITUDE, LOGICAL_REASONING, ENGLISH, COMMUNICATION, BEHAVIORAL.
*   *Fallback:* Use \`ANY_LANGUAGE\` if technical but generic; use \`GENERAL\` if non-technical.

**4. TOPIC & SUB_TOPIC**
*   **topic:** High-level category (e.g., "Java", "Behavioral", "Project").
*   **sub_topic:** Specific concept (e.g., "Collections", "Team Conflict", "Architecture").

### EXTRACTION RULES
*   Convert shorthand notes into proper interview questions.
*   If input is a keyword (e.g., "Java Basics"), infer the most likely interview question.
*   If input references an assessment/link, infer a relevant interview question from that context.
*   Always return non-empty \`question_text\` for valid technical or interview-related notes.

### OUTPUT FORMAT
Provide ONLY the raw JSON array. No markdown.
`;
const ROUND_COLUMN_MAP = {
    "Screening Questions": "Screening Round",
    "Assessment questions": "Assessment",
    "Technical round Questions": "Technical Round 1",
    "Technical2 round Questions": "Technical Round 2",
    "H.R Questions": "HR Round",
    "Cultural fit Round Questions": "Cultural Fit Round",
    "Managerial Round questions": "Managerial Round",
    "CEO/Founder/Director Round Questions": "CEO/Director Round",
};
const SHEET_HEADERS = [
    "job_id",
    "company_name",
    "user_id",
    "full_name",
    "mobile_number",
    "interview_round",
    "questions",
    "question_type",
    "tech_stacks",
    "topic",
    "sub_topic",
    "difficulty_level",
    "curriculum_coverage",
    "question_uid",
    "interview_date",
    "question_creation_datetime",
    "product",
];
const nowDate = () => new Date().toISOString().slice(0, 10);
const nowDateTime = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const NON_TECHNICAL_QUESTION_TYPES = new Set(["BEHAVIORAL", "SELF_INTRODUCTION", "GENERAL"]);
const GENERIC_ENUM_VALUES = new Set([
    "N/A",
    "GENERAL",
    "ANY_LANGUAGE",
    "BEHAVIORAL",
    "COMMUNICATION",
    "ENGLISH",
    "APTITUDE",
    "LOGICAL_REASONING",
]);
const COVERAGE_STOP_WORDS = new Set([
    "WHAT",
    "WHEN",
    "WHERE",
    "WHICH",
    "WHO",
    "WHOM",
    "WHY",
    "HOW",
    "IS",
    "ARE",
    "WAS",
    "WERE",
    "DO",
    "DOES",
    "DID",
    "THE",
    "A",
    "AN",
    "TO",
    "OF",
    "IN",
    "ON",
    "AT",
    "FOR",
    "WITH",
    "BY",
    "AND",
    "OR",
    "FROM",
    "AS",
    "YOUR",
    "YOU",
    "THEIR",
    "THEM",
    "THIS",
    "THAT",
    "THESE",
    "THOSE",
    "EXPLAIN",
    "DIFFERENCE",
    "BETWEEN",
    "ABOUT",
]);
const normalizeForCoverage = (value) => {
    return value
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
};
const tokenizeForCoverage = (value, minLength = 4) => {
    const normalized = normalizeForCoverage(value);
    if (!normalized)
        return [];
    const tokens = normalized
        .split(" ")
        .filter((token) => token.length >= minLength)
        .filter((token) => !COVERAGE_STOP_WORDS.has(token));
    return Array.from(new Set(tokens));
};
const buildCurriculumCoverageLookup = (curriculumText) => {
    const normalized = normalizeForCoverage(curriculumText);
    const tokenSet = new Set(tokenizeForCoverage(curriculumText));
    return {
        hasCurriculum: normalized.length > 0,
        normalizedText: normalized.length > 0 ? ` ${normalized} ` : "",
        tokenSet,
    };
};
const hasPhraseCoverage = (lookup, value) => {
    const normalized = normalizeForCoverage(value);
    if (normalized.length < 3)
        return false;
    return lookup.normalizedText.includes(` ${normalized} `);
};
const hasSignalTokenCoverage = (lookup, values) => {
    const signalTokens = values.flatMap((value) => tokenizeForCoverage(value, 3));
    if (signalTokens.length === 0)
        return false;
    let matches = 0;
    for (const token of signalTokens) {
        if (lookup.tokenSet.has(token)) {
            matches += 1;
            if (matches >= 1) {
                return true;
            }
        }
    }
    return false;
};
const hasQuestionTokenCoverage = (lookup, questionText) => {
    const tokens = tokenizeForCoverage(questionText, 4);
    if (tokens.length === 0)
        return false;
    let matches = 0;
    for (const token of tokens) {
        if (lookup.tokenSet.has(token)) {
            matches += 1;
            if (matches >= 2) {
                return true;
            }
        }
    }
    return false;
};
const deriveCurriculumCoverage = (args) => {
    const { lookup, questionText, questionType, techStack, topic, subTopic } = args;
    if (!lookup.hasCurriculum) {
        return "N/A";
    }
    if (NON_TECHNICAL_QUESTION_TYPES.has(questionType)) {
        return "N/A";
    }
    if (GENERIC_ENUM_VALUES.has(techStack)) {
        return "N/A";
    }
    const coverageSignals = [techStack, topic, subTopic]
        .filter((value) => !GENERIC_ENUM_VALUES.has(value))
        .map((value) => value.replace(/_/g, " "));
    if (coverageSignals.some((value) => hasPhraseCoverage(lookup, value))) {
        return "COVERED";
    }
    if (hasSignalTokenCoverage(lookup, coverageSignals)) {
        return "COVERED";
    }
    if (hasQuestionTokenCoverage(lookup, questionText)) {
        return "COVERED";
    }
    return "NOT_COVERED";
};
const applyCurriculumCoverageForCandidateRows = (candidateRows, coverageLookup) => {
    for (const row of candidateRows) {
        row.curriculum_coverage = deriveCurriculumCoverage({
            lookup: coverageLookup,
            questionText: row.questions ?? "",
            questionType: row.question_type ?? "GENERAL",
            techStack: row.tech_stacks ?? "GENERAL",
            topic: row.topic ?? "N/A",
            subTopic: row.sub_topic ?? "N/A",
        });
    }
    return candidateRows;
};
const isValidRoundText = (value) => {
    if (value === null || value === undefined)
        return false;
    const text = String(value).trim();
    if (!text)
        return false;
    return !["nan", "no", "yes", "na", "none", "null", ""].includes(text.toLowerCase());
};
const analyzeRound = async (systemPrompt, roundName, roundText) => {
    const userContent = [
        "ROUND INPUT (JSON):",
        JSON.stringify({
            interview_round: roundName,
            round_text: roundText,
        }),
        "",
        "Extract all interview questions from this round and classify them.",
    ].join("\n");
    const extracted = await (0, mistral_1.mistralJsonAsArray)([
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ], {
        responseAsJsonObject: true,
        temperature: 0.1,
    });
    return extracted;
};
const analyzeCandidateRow = async (args) => {
    const { row, rowIndex, totalRows, product, systemPrompt, coverageLookup, onStatus, abortIfCancelled } = args;
    const candidateNumber = rowIndex + 1;
    onStatus?.(`Analyzing candidate ${candidateNumber}/${totalRows}...`);
    const dateVal = (row["Interview Date"] || row.interview_date || nowDate()).trim();
    const userId = (row["User ID"] || row.user_id || "N/A").trim();
    const userName = (row["User Name"] || row.user_name || "N/A").trim();
    const mobile = (row["Mobile Number"] || row.mobile_number || "N/A").trim();
    const jobId = (row["Job ID"] || row.job_id || "N/A").trim();
    const company = (row["Company Name"] || row.company_name || "N/A").trim();
    const candidateRows = [];
    const roundIssues = [];
    let analyzedRoundCount = 0;
    for (const [columnName, roundName] of Object.entries(ROUND_COLUMN_MAP)) {
        abortIfCancelled?.();
        const rawRound = row[columnName];
        if (!isValidRoundText(rawRound))
            continue;
        analyzedRoundCount += 1;
        onStatus?.(`Classifying ${roundName} for candidate ${candidateNumber}/${totalRows}...`);
        let extractedItems = [];
        try {
            extractedItems = await analyzeRound(systemPrompt, roundName, String(rawRound));
        }
        catch (error) {
            roundIssues.push(`${roundName}: ${String(error)}`);
            onStatus?.(`Skipping ${roundName} for candidate ${candidateNumber}/${totalRows}: ${String(error)}`);
            continue;
        }
        if (extractedItems.length === 0) {
            roundIssues.push(`${roundName}: model returned no parseable questions`);
            continue;
        }
        abortIfCancelled?.();
        let addedForRound = 0;
        for (const item of extractedItems) {
            const questionText = String(item.question_text ?? "").trim();
            if (!questionText)
                continue;
            const questionType = (0, enum_1.forceEnumFormat)(item.question_type ?? "GENERAL");
            const techStacks = (0, enum_1.forceEnumFormat)(item.question_concept ?? "GENERAL");
            const topic = (0, enum_1.forceEnumFormat)(item.topic ?? "N/A");
            const subTopic = (0, enum_1.forceEnumFormat)(item.sub_topic ?? "N/A");
            addedForRound += 1;
            candidateRows.push({
                job_id: jobId,
                company_name: company,
                user_id: userId,
                full_name: userName,
                mobile_number: mobile,
                interview_round: (0, enum_1.forceEnumFormat)(roundName),
                questions: questionText,
                question_type: questionType,
                tech_stacks: techStacks,
                topic,
                sub_topic: subTopic,
                difficulty_level: (0, enum_1.forceEnumFormat)(item.difficulty ?? "MEDIUM"),
                curriculum_coverage: "N/A",
                question_uid: (0, node_crypto_1.randomUUID)().replace(/-/g, ""),
                interview_date: dateVal,
                question_creation_datetime: nowDateTime(),
                product,
            });
        }
        if (addedForRound === 0) {
            roundIssues.push(`${roundName}: model output missing question_text`);
        }
    }
    if (analyzedRoundCount > 0 && candidateRows.length === 0) {
        const reason = roundIssues.length > 0
            ? roundIssues.slice(0, 4).join(" | ")
            : "Model returned empty output for all rounds";
        throw new Error(`No questions extracted for candidate ${candidateNumber}/${totalRows}. ${reason}`);
    }
    onStatus?.(`Checking curriculum coverage for candidate ${candidateNumber}/${totalRows}...`);
    return applyCurriculumCoverageForCandidateRows(candidateRows, coverageLookup);
};
const analyzeDrilldownRows = async (rows, product, onStatus, abortIfCancelled) => {
    abortIfCancelled?.();
    onStatus?.("Loading curriculum context...");
    const curriculumText = await (0, curriculum_1.getCurriculumText)();
    const coverageLookup = buildCurriculumCoverageLookup(curriculumText);
    const curriculum = curriculumText.slice(0, config_1.DRILLDOWN_CURRICULUM_SNIPPET_LENGTH);
    abortIfCancelled?.();
    const systemPrompt = DRILLDOWN_PROMPT_TEMPLATE.replace("{{CURRICULUM_CONTEXT}}", curriculum);
    const totalRows = rows.length;
    const finalRows = [];
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex += 1) {
        abortIfCancelled?.();
        const candidateRows = await analyzeCandidateRow({
            row: rows[rowIndex],
            rowIndex,
            totalRows,
            product,
            systemPrompt,
            coverageLookup,
            onStatus,
            abortIfCancelled,
        });
        finalRows.push(...candidateRows);
    }
    const orderedRows = finalRows.map((row) => {
        const normalized = {};
        for (const header of SHEET_HEADERS) {
            normalized[header] = row[header] ?? "N/A";
        }
        return normalized;
    });
    if (rows.length > 0 && orderedRows.length === 0) {
        throw new Error("No questions were extracted from drilldown input. Check round note quality and model JSON output.");
    }
    abortIfCancelled?.();
    onStatus?.("Saving drilldown results to sheet...");
    const savedToSheet = await (0, google_1.appendRowsWithHeaders)({
        sheetName: config_1.SHEET_NAMES.drilldown,
        headers: SHEET_HEADERS,
        rows: orderedRows,
    });
    return { rows: orderedRows, savedToSheet };
};
exports.analyzeDrilldownRows = analyzeDrilldownRows;
const getDrilldownSampleCsv = () => {
    return [
        "Interview Date,User ID,User Name,Mobile Number,Job ID,Company Name,Screening Questions,Assessment questions,Technical round Questions,Technical2 round Questions,H.R Questions,Cultural fit Round Questions,Managerial Round questions,CEO/Founder/Director Round Questions",
        "2023-01-01,U123,John,9999,J1,Google,Intro?,Test Link,Java Basics,System Design,Why us?,Values?,Manage Team?,Future goals?",
    ].join("\n");
};
exports.getDrilldownSampleCsv = getDrilldownSampleCsv;
