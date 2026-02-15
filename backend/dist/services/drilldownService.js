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
You will receive a JSON array of Q&A pairs. Your task is to classify, tag, and enrich each pair with standardized metadata.

### INPUT DATA
A list of objects containing \`question_text\` and \`answer_text\`.

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
const isValidRoundText = (value) => {
    if (value === null || value === undefined)
        return false;
    const text = String(value).trim();
    if (!text)
        return false;
    return !["nan", "no", "yes", "na", "none", "null", ""].includes(text.toLowerCase());
};
const analyzeRound = async (systemPrompt, roundName, roundText) => {
    const userContent = `RAW INTERVIEW NOTES for ${roundName}:\n\n${roundText}`;
    const extracted = await (0, mistral_1.mistralJsonAsArray)([
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
    ], { responseAsJsonObject: true, temperature: 0.1 });
    return extracted;
};
const analyzeDrilldownRows = async (rows, product, onStatus, abortIfCancelled) => {
    abortIfCancelled?.();
    onStatus?.("Loading curriculum context...");
    const curriculum = await (0, curriculum_1.getCurriculumSnippet)(15000);
    abortIfCancelled?.();
    const systemPrompt = DRILLDOWN_PROMPT_TEMPLATE.replace("{{CURRICULUM_CONTEXT}}", curriculum);
    const finalRows = [];
    const totalRows = rows.length;
    let currentRow = 0;
    for (const row of rows) {
        abortIfCancelled?.();
        currentRow += 1;
        onStatus?.(`Analyzing candidate ${currentRow}/${totalRows}...`);
        const dateVal = (row["Interview Date"] || row.interview_date || nowDate()).trim();
        const userId = (row["User ID"] || row.user_id || "N/A").trim();
        const userName = (row["User Name"] || row.user_name || "N/A").trim();
        const mobile = (row["Mobile Number"] || row.mobile_number || "N/A").trim();
        const jobId = (row["Job ID"] || row.job_id || "N/A").trim();
        const company = (row["Company Name"] || row.company_name || "N/A").trim();
        for (const [columnName, roundName] of Object.entries(ROUND_COLUMN_MAP)) {
            abortIfCancelled?.();
            const rawRound = row[columnName];
            if (!isValidRoundText(rawRound))
                continue;
            onStatus?.(`Classifying ${roundName} for candidate ${currentRow}/${totalRows}...`);
            const extractedItems = await analyzeRound(systemPrompt, roundName, String(rawRound));
            abortIfCancelled?.();
            for (const item of extractedItems) {
                finalRows.push({
                    job_id: jobId,
                    company_name: company,
                    user_id: userId,
                    full_name: userName,
                    mobile_number: mobile,
                    interview_round: (0, enum_1.forceEnumFormat)(roundName),
                    questions: String(item.question_text ?? ""),
                    question_type: (0, enum_1.forceEnumFormat)(item.question_type ?? "GENERAL"),
                    tech_stacks: (0, enum_1.forceEnumFormat)(item.question_concept ?? "GENERAL"),
                    topic: (0, enum_1.forceEnumFormat)(item.topic ?? "N/A"),
                    sub_topic: (0, enum_1.forceEnumFormat)(item.sub_topic ?? "N/A"),
                    difficulty_level: (0, enum_1.forceEnumFormat)(item.difficulty ?? "MEDIUM"),
                    curriculum_coverage: (0, enum_1.forceEnumFormat)(item.curriculum_coverage ?? "N/A"),
                    question_uid: (0, node_crypto_1.randomUUID)().replace(/-/g, ""),
                    interview_date: dateVal,
                    question_creation_datetime: nowDateTime(),
                    product,
                });
            }
        }
    }
    const orderedRows = finalRows.map((row) => {
        const normalized = {};
        for (const header of SHEET_HEADERS) {
            normalized[header] = row[header] ?? "N/A";
        }
        return normalized;
    });
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
