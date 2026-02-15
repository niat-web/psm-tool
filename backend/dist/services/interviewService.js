"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runVideoUploader = exports.runInterviewAnalyzer = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const config_1 = require("../config");
const curriculum_1 = require("../utils/curriculum");
const enum_1 = require("../utils/enum");
const fs_1 = require("../utils/fs");
const gist_1 = require("../utils/gist");
const google_1 = require("../utils/google");
const media_1 = require("../utils/media");
const mistral_1 = require("../utils/mistral");
const prompts_1 = require("../utils/prompts");
const SHEET_HEADERS = [
    "user_id",
    "full_name",
    "mobile_number",
    "job_id",
    "company_name",
    "question_text",
    "answer_text",
    "relevancy_score",
    "question_type",
    "tech_stacks",
    "topic",
    "sub_topic",
    "difficulty",
    "interview_round",
    "clip_start_time",
    "clip_end_time",
    "video_link",
    "transcript_link",
    "drive_file_id",
    "curriculum_coverage",
    "question_uid",
    "interview_date",
    "question_creation_datetime",
    "source_type",
    "product",
];
const CLASSIFY_FIELDS = [
    "question_type",
    "question_concept",
    "difficulty",
    "topic",
    "sub_topic",
    "relevancy_score",
    "curriculum_coverage",
];
const nowDate = () => new Date().toISOString().slice(0, 10);
const nowDateTime = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const cleanupFiles = (paths) => {
    const unique = [...new Set(paths.map((item) => item.trim()).filter((item) => item.length > 0))];
    for (const filePath of unique) {
        (0, fs_1.safeRemoveFile)(filePath);
    }
};
const parseModelResultAsArray = (content) => {
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed.filter((entry) => typeof entry === "object" && entry !== null);
        }
        if (typeof parsed === "object" && parsed !== null) {
            for (const value of Object.values(parsed)) {
                if (Array.isArray(value)) {
                    return value.filter((entry) => typeof entry === "object" && entry !== null);
                }
            }
            return [parsed];
        }
        return [];
    }
    catch {
        return [];
    }
};
const getMistralCompletion = async (prompt, content) => {
    const response = await (0, mistral_1.mistralChat)([
        { role: "system", content: `${prompt} Return ONLY valid JSON. No markdown.` },
        { role: "user", content },
    ], { temperature: 0.1, timeoutMs: 120000 });
    return response || "[]";
};
const deduplicateQna = (items) => {
    const seen = new Set();
    const unique = [];
    for (const item of items) {
        const key = String(item.question_text ?? "").trim();
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        unique.push(item);
    }
    return unique;
};
const mergeClassification = (original, classified) => {
    const index = new Map();
    for (const item of classified) {
        const key = String(item.question_text ?? "").trim();
        if (key)
            index.set(key, item);
    }
    return original.map((item) => {
        const key = String(item.question_text ?? "").trim();
        const match = index.get(key) ?? {};
        const merged = { ...item };
        for (const field of CLASSIFY_FIELDS) {
            if (match[field] !== undefined) {
                merged[field] = String(match[field]);
            }
        }
        for (const field of CLASSIFY_FIELDS) {
            if (merged[field] === undefined) {
                merged[field] = "N/A";
            }
        }
        return merged;
    });
};
const classifyQnaList = async (qna, classifyPrompt, batchSize = 12, abortIfCancelled) => {
    if (qna.length === 0)
        return [];
    const classified = [];
    for (let index = 0; index < qna.length; index += batchSize) {
        abortIfCancelled?.();
        const batch = qna.slice(index, index + batchSize);
        const content = JSON.stringify(batch);
        const response = await getMistralCompletion(classifyPrompt, content);
        abortIfCancelled?.();
        classified.push(...parseModelResultAsArray(response));
    }
    return mergeClassification(qna, classified);
};
const processLargeTranscriptWithOverlap = async (transcript, prompt, chunkSize = 12000, overlap = 1000, abortIfCancelled) => {
    const extracted = [];
    let start = 0;
    while (start < transcript.length) {
        abortIfCancelled?.();
        let end = Math.min(start + chunkSize, transcript.length);
        if (end < transcript.length) {
            const nextNewline = transcript.indexOf("\n", end);
            if (nextNewline !== -1 && nextNewline - end < 200) {
                end = nextNewline;
            }
        }
        const chunk = transcript.slice(start, end);
        const content = `Analyze this interview segment:\n\n${chunk}`;
        const response = await getMistralCompletion(prompt, content);
        abortIfCancelled?.();
        const parsed = parseModelResultAsArray(response);
        for (const item of parsed) {
            extracted.push({
                question_text: String(item.question_text ?? ""),
                answer_text: String(item.answer_text ?? ""),
            });
        }
        start += chunkSize - overlap;
        if (start >= transcript.length) {
            break;
        }
    }
    return extracted;
};
const generateTranscript = async (audioPath, outputPath, onStatus, abortIfCancelled) => {
    const chunks = (0, media_1.splitAudioIntoChunks)(audioPath);
    let offset = 0;
    let transcriptBuffer = "";
    const totalChunks = chunks.length;
    let chunkIndex = 0;
    for (const chunk of chunks) {
        abortIfCancelled?.();
        chunkIndex += 1;
        onStatus?.(`Generating transcript chunk ${chunkIndex}/${totalChunks}...`);
        const segments = await (0, mistral_1.mistralTranscribeAudio)(chunk);
        abortIfCancelled?.();
        transcriptBuffer += `${(0, media_1.mistralSegmentsToCleanText)(segments, offset)}\n`;
        offset += (0, media_1.getMediaDuration)(chunk) ?? 0;
        if (chunk !== audioPath) {
            (0, fs_1.safeRemoveFile)(chunk);
        }
    }
    const cleaned = (0, media_1.cleanTranscriptHallucinations)(transcriptBuffer.trim());
    (0, fs_1.writeTextFile)(outputPath, cleaned);
};
const downloadViaPublicDrive = async (fileId, outputPath) => {
    const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
        const response = await fetch(url, { redirect: "follow" });
        if (!response.ok) {
            return false;
        }
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/html")) {
            const html = await response.text();
            const tokenMatch = html.match(/confirm=([0-9A-Za-z_\-]+)/);
            if (!tokenMatch) {
                return false;
            }
            const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${tokenMatch[1]}&id=${fileId}`;
            const confirmResponse = await fetch(confirmUrl, { redirect: "follow" });
            if (!confirmResponse.ok) {
                return false;
            }
            const buffer = Buffer.from(await confirmResponse.arrayBuffer());
            node_fs_1.default.writeFileSync(outputPath, buffer);
            return true;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        node_fs_1.default.writeFileSync(outputPath, buffer);
        return true;
    }
    catch {
        return false;
    }
};
const cleanDriveId = (value) => {
    const text = String(value ?? "").trim();
    const match = text.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]{10,})/);
    return match?.[1] ?? text;
};
const parseTime = (value) => {
    if (value === null || value === undefined)
        return null;
    const text = String(value).trim();
    if (!text || text.toUpperCase() === "N/A")
        return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
};
const mapQaToSheetRows = (args) => {
    return args.qaItems.map((item) => ({
        user_id: args.meta.userId,
        full_name: args.meta.fullName,
        mobile_number: args.meta.mobile,
        job_id: args.meta.jobId,
        company_name: args.meta.companyName,
        question_text: String(item.question_text ?? ""),
        answer_text: String(item.answer_text ?? ""),
        relevancy_score: String(item.relevancy_score ?? "N/A"),
        question_type: (0, enum_1.forceEnumFormat)(item.question_type ?? "N/A"),
        tech_stacks: (0, enum_1.forceEnumFormat)(item.question_concept ?? "N/A"),
        topic: (0, enum_1.forceEnumFormat)(item.topic ?? "N/A"),
        sub_topic: (0, enum_1.forceEnumFormat)(item.sub_topic ?? "N/A"),
        difficulty: (0, enum_1.forceEnumFormat)(item.difficulty ?? "N/A"),
        interview_round: (0, enum_1.forceEnumFormat)(args.meta.interviewRound),
        clip_start_time: String(args.meta.clipStart),
        clip_end_time: String(args.meta.clipEnd),
        video_link: args.meta.videoLink,
        transcript_link: args.meta.transcriptLink,
        drive_file_id: args.meta.driveFileId,
        curriculum_coverage: (0, enum_1.forceEnumFormat)(item.curriculum_coverage ?? "N/A"),
        question_uid: (0, node_crypto_1.randomUUID)().replace(/-/g, ""),
        interview_date: nowDate(),
        question_creation_datetime: nowDateTime(),
        source_type: args.meta.sourceType,
        product: args.meta.product,
    }));
};
const ensureHeaderOrder = (rows) => {
    return rows.map((row) => {
        const ordered = {};
        for (const header of SHEET_HEADERS) {
            ordered[header] = row[header] ?? "N/A";
        }
        return ordered;
    });
};
const runQnaPipeline = async (args) => {
    args.abortIfCancelled?.();
    const raw = await processLargeTranscriptWithOverlap(args.transcriptText, args.qnaPrompt, config_1.QNA_CHUNK_SIZE, config_1.QNA_CHUNK_OVERLAP, args.abortIfCancelled);
    args.abortIfCancelled?.();
    const deduped = deduplicateQna(raw);
    return classifyQnaList(deduped, args.classifyPrompt, 12, args.abortIfCancelled);
};
const saveQaCsv = (filePath, rows) => {
    if (rows.length === 0)
        return;
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(",")];
    for (const row of rows) {
        lines.push(headers
            .map((header) => {
            const value = String(row[header] ?? "");
            if (value.includes(",") || value.includes("\n") || value.includes('"')) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        })
            .join(","));
    }
    (0, fs_1.writeTextFile)(filePath, lines.join("\n"));
};
const processInterviewRow = async (args) => {
    args.abortIfCancelled?.();
    const userId = String(args.row.user_id ?? "N/A").trim();
    const fileId = cleanDriveId(args.row.drive_file_id);
    const fullName = String(args.row.fullName ?? "N/A").trim();
    const mobile = String(args.row.MobileNumber ?? "N/A").trim();
    const jobId = String(args.row.job_id ?? "N/A").trim();
    const company = String(args.row.company_name ?? "N/A").trim();
    const interviewRound = String(args.row.interview_round ?? "N/A").trim();
    const rawStart = parseTime(args.row.clip_start_time);
    const rawEnd = parseTime(args.row.clip_end_time);
    const processFullVideo = rawEnd === null;
    let startTime = rawStart ?? 0;
    let endTime = rawEnd ?? 0;
    const videoPath = node_path_1.default.join(config_1.APP_DIRS.downloadedVideos, `${fileId}.mp4`);
    const videoUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const candidatePrefix = `Candidate ${args.rowIndex}/${args.totalRows}`;
    args.onStatus?.(`${candidatePrefix}: validating cached video...`);
    let videoValidation = (0, media_1.validateVideoFile)(videoPath);
    if (!videoValidation.ok && node_fs_1.default.existsSync(videoPath)) {
        (0, fs_1.safeRemoveFile)(videoPath);
    }
    if (!node_fs_1.default.existsSync(videoPath)) {
        args.abortIfCancelled?.();
        args.onStatus?.(`${candidatePrefix}: downloading video...`);
        const publicDownloadOk = await downloadViaPublicDrive(fileId, videoPath);
        args.abortIfCancelled?.();
        videoValidation = (0, media_1.validateVideoFile)(videoPath);
        if (!publicDownloadOk || !videoValidation.ok) {
            if (node_fs_1.default.existsSync(videoPath))
                (0, fs_1.safeRemoveFile)(videoPath);
            args.onStatus?.(`${candidatePrefix}: trying Drive API download...`);
            const driveResult = await (0, google_1.downloadDriveFileToPath)(fileId, videoPath);
            args.abortIfCancelled?.();
            if (driveResult !== "Success") {
                (0, fs_1.safeRemoveFile)(videoPath);
                throw new Error(`Drive API Download failed (${driveResult}).`);
            }
            videoValidation = (0, media_1.validateVideoFile)(videoPath);
            if (!videoValidation.ok) {
                (0, fs_1.safeRemoveFile)(videoPath);
                throw new Error(`Drive API file invalid (${videoValidation.reason}).`);
            }
        }
    }
    const finalValidation = (0, media_1.validateVideoFile)(videoPath);
    if (!finalValidation.ok) {
        (0, fs_1.safeRemoveFile)(videoPath);
        throw new Error(`Failed to get a valid video file (${finalValidation.reason}).`);
    }
    if (processFullVideo || endTime === 0) {
        args.abortIfCancelled?.();
        args.onStatus?.(`${candidatePrefix}: determining clip duration...`);
        const duration = (0, media_1.getMediaDuration)(videoPath);
        if (!duration) {
            throw new Error("Could not determine video duration.");
        }
        endTime = duration;
    }
    const baseName = `${fileId}_${Math.floor(startTime)}_${Math.floor(endTime)}`;
    const audioPath = node_path_1.default.join(config_1.APP_DIRS.downloadedVideos, `${baseName}.mp3`);
    const transcriptPath = node_path_1.default.join(config_1.APP_DIRS.generatedTranscripts, `${baseName}.txt`);
    const qnaCsvPath = node_path_1.default.join(config_1.APP_DIRS.qa, `${baseName}_consolidated.csv`);
    if (!node_fs_1.default.existsSync(audioPath)) {
        args.abortIfCancelled?.();
        args.onStatus?.(`${candidatePrefix}: extracting audio...`);
        (0, media_1.extractAudioSegment)(videoPath, audioPath, startTime, endTime);
    }
    if (!node_fs_1.default.existsSync(transcriptPath)) {
        args.abortIfCancelled?.();
        args.onStatus?.(`${candidatePrefix}: generating transcript...`);
        await generateTranscript(audioPath, transcriptPath, args.onStatus, args.abortIfCancelled);
    }
    args.abortIfCancelled?.();
    const transcriptText = (0, fs_1.readTextFileIfExists)(transcriptPath);
    let transcriptLink = "N/A";
    if (transcriptText.trim()) {
        args.abortIfCancelled?.();
        args.onStatus?.(`${candidatePrefix}: creating transcript gist...`);
        transcriptLink = await (0, gist_1.createPublicGist)(`transcript_${baseName}.txt`, transcriptText);
        args.abortIfCancelled?.();
    }
    args.abortIfCancelled?.();
    args.onStatus?.(`${candidatePrefix}: extracting Q&A...`);
    const qaItems = await runQnaPipeline({
        transcriptText,
        qnaPrompt: args.qnaPrompt,
        classifyPrompt: args.classifyPrompt,
        abortIfCancelled: args.abortIfCancelled,
    });
    args.abortIfCancelled?.();
    const rows = mapQaToSheetRows({
        qaItems,
        meta: {
            userId,
            fullName,
            mobile,
            jobId,
            companyName: company,
            interviewRound,
            clipStart: startTime,
            clipEnd: endTime,
            videoLink: videoUrl,
            transcriptLink,
            driveFileId: fileId,
            sourceType: "Interview analyser",
            product: args.product,
        },
    });
    args.abortIfCancelled?.();
    saveQaCsv(qnaCsvPath, rows);
    return {
        rows,
        cleanupPaths: [videoPath, audioPath, transcriptPath, qnaCsvPath],
    };
};
const runInterviewAnalyzer = async (args) => {
    args.abortIfCancelled?.();
    args.onStatus?.("Preparing interview analyzer...");
    (0, fs_1.ensureDirs)(Object.values(config_1.APP_DIRS));
    if (!(0, media_1.checkFfmpegInstalled)()) {
        throw new Error("FFmpeg is not installed.");
    }
    args.onStatus?.("Loading curriculum and prompts...");
    const curriculum = await (0, curriculum_1.getCurriculumSnippet)(15000);
    args.abortIfCancelled?.();
    const qnaPrompt = (0, prompts_1.loadQnaPrompt)();
    const classifyTemplate = (0, prompts_1.loadClassifyPromptTemplate)();
    const classifyPrompt = classifyTemplate.replace("{{CURRICULUM_CONTEXT}}", curriculum);
    const finalRows = [];
    const cleanupPaths = [];
    const totalRows = args.rows.length;
    let rowIndex = 0;
    for (const row of args.rows) {
        args.abortIfCancelled?.();
        rowIndex += 1;
        const processed = await processInterviewRow({
            row,
            qnaPrompt,
            classifyPrompt,
            product: args.product,
            rowIndex,
            totalRows,
            onStatus: args.onStatus,
            abortIfCancelled: args.abortIfCancelled,
        });
        finalRows.push(...processed.rows);
        cleanupPaths.push(...processed.cleanupPaths);
        args.onStatus?.(`Candidate ${rowIndex}/${totalRows}: completed.`, {
            rows: ensureHeaderOrder(finalRows),
            savedToSheet: false,
        });
    }
    args.abortIfCancelled?.();
    const orderedRows = ensureHeaderOrder(finalRows);
    args.onStatus?.("Saving interview rows to sheet...");
    const savedToSheet = await (0, google_1.appendRowsWithHeaders)({
        sheetName: config_1.SHEET_NAMES.interview,
        headers: SHEET_HEADERS,
        rows: orderedRows,
    });
    if (savedToSheet) {
        args.onStatus?.("Cleaning up local interview artifacts...");
        cleanupFiles(cleanupPaths);
    }
    return { rows: orderedRows, savedToSheet };
};
exports.runInterviewAnalyzer = runInterviewAnalyzer;
const runVideoUploader = async (args) => {
    args.abortIfCancelled?.();
    args.onStatus?.("Preparing local video uploader...");
    (0, fs_1.ensureDirs)(Object.values(config_1.APP_DIRS));
    if (!(0, media_1.checkFfmpegInstalled)()) {
        throw new Error("FFmpeg is not installed.");
    }
    args.onStatus?.("Loading curriculum and prompts...");
    const curriculum = await (0, curriculum_1.getCurriculumSnippet)(15000);
    args.abortIfCancelled?.();
    const qnaPrompt = (0, prompts_1.loadQnaPrompt)();
    const classifyTemplate = (0, prompts_1.loadClassifyPromptTemplate)();
    const classifyPrompt = classifyTemplate.replace("{{CURRICULUM_CONTEXT}}", curriculum);
    const timestamp = Date.now();
    args.abortIfCancelled?.();
    args.onStatus?.("Saving uploaded video...");
    const sourceVideoPath = node_path_1.default.join(config_1.APP_DIRS.downloadedVideos, args.uploadedFile.originalname);
    node_fs_1.default.writeFileSync(sourceVideoPath, args.uploadedFile.buffer);
    const baseName = `${args.metadata.user_id || "candidate"}_${timestamp}`;
    const audioPath = node_path_1.default.join(config_1.APP_DIRS.downloadedVideos, `${baseName}.mp3`);
    const transcriptPath = node_path_1.default.join(config_1.APP_DIRS.generatedTranscripts, `${baseName}.txt`);
    if (!node_fs_1.default.existsSync(audioPath)) {
        args.abortIfCancelled?.();
        args.onStatus?.("Extracting audio...");
        (0, media_1.extractAudioFile)(sourceVideoPath, audioPath);
    }
    if (!node_fs_1.default.existsSync(transcriptPath)) {
        args.abortIfCancelled?.();
        args.onStatus?.("Generating transcript...");
        await generateTranscript(audioPath, transcriptPath, args.onStatus, args.abortIfCancelled);
    }
    args.abortIfCancelled?.();
    const transcriptText = (0, fs_1.readTextFileIfExists)(transcriptPath);
    args.onStatus?.("Creating transcript gist...");
    const transcriptLink = transcriptText
        ? await (0, gist_1.createPublicGist)(`trans_${baseName}.txt`, transcriptText)
        : "N/A";
    args.abortIfCancelled?.();
    args.onStatus?.("Extracting and classifying Q&A...");
    const qaItems = await runQnaPipeline({
        transcriptText,
        qnaPrompt,
        classifyPrompt,
        abortIfCancelled: args.abortIfCancelled,
    });
    args.abortIfCancelled?.();
    const clipEnd = (0, media_1.getMediaDuration)(sourceVideoPath) ?? 0;
    const rows = mapQaToSheetRows({
        qaItems,
        meta: {
            userId: String(args.metadata.user_id ?? "N/A"),
            fullName: String(args.metadata.fullName ?? "N/A"),
            mobile: String(args.metadata.MobileNumber ?? "N/A"),
            jobId: String(args.metadata.job_id ?? "N/A"),
            companyName: String(args.metadata.company_name ?? "N/A"),
            interviewRound: String(args.metadata.interview_round ?? "N/A"),
            clipStart: 0,
            clipEnd,
            videoLink: "Local Upload",
            transcriptLink,
            driveFileId: "Local",
            sourceType: "Video uploader",
            product: args.product,
        },
    });
    const orderedRows = ensureHeaderOrder(rows);
    args.abortIfCancelled?.();
    args.onStatus?.("Saving video uploader rows to sheet...");
    const savedToSheet = await (0, google_1.appendRowsWithHeaders)({
        sheetName: config_1.SHEET_NAMES.interview,
        headers: SHEET_HEADERS,
        rows: orderedRows,
    });
    if (savedToSheet) {
        args.onStatus?.("Cleaning up local video uploader artifacts...");
        cleanupFiles([sourceVideoPath, audioPath, transcriptPath]);
    }
    return { rows: orderedRows, savedToSheet };
};
exports.runVideoUploader = runVideoUploader;
