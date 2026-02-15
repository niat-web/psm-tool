"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanTranscriptHallucinations = exports.mistralSegmentsToCleanText = exports.formatTimestampClean = exports.splitAudioIntoChunks = exports.extractAudioFile = exports.extractAudioSegment = exports.validateVideoFile = exports.getMediaDuration = exports.checkFfmpegInstalled = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const checkFfmpegInstalled = () => {
    const ffmpeg = (0, node_child_process_1.spawnSync)("ffmpeg", ["-version"], { stdio: "ignore" });
    const ffprobe = (0, node_child_process_1.spawnSync)("ffprobe", ["-version"], { stdio: "ignore" });
    return ffmpeg.status === 0 && ffprobe.status === 0;
};
exports.checkFfmpegInstalled = checkFfmpegInstalled;
const getMediaDuration = (mediaPath) => {
    const result = (0, node_child_process_1.spawnSync)("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        mediaPath,
    ], { encoding: "utf8" });
    if (result.status !== 0) {
        return null;
    }
    const value = Number(result.stdout.trim());
    return Number.isFinite(value) ? value : null;
};
exports.getMediaDuration = getMediaDuration;
const validateVideoFile = (videoPath, minSizeBytes = 100 * 1024) => {
    if (!node_fs_1.default.existsSync(videoPath)) {
        return { ok: false, reason: "File not found" };
    }
    const stats = node_fs_1.default.statSync(videoPath);
    if (stats.size < minSizeBytes) {
        return { ok: false, reason: `File too small (${(stats.size / 1024).toFixed(2)} KB)` };
    }
    const duration = (0, exports.getMediaDuration)(videoPath);
    if (!duration || duration <= 0) {
        return { ok: false, reason: "Unreadable video (ffprobe failed)" };
    }
    return { ok: true, reason: "" };
};
exports.validateVideoFile = validateVideoFile;
const runFfmpegCommand = (args) => {
    const result = (0, node_child_process_1.spawnSync)("ffmpeg", args, { encoding: "utf8" });
    if (result.status === 0) {
        return { ok: true, errorText: "" };
    }
    return {
        ok: false,
        errorText: (result.stderr || result.stdout || `ffmpeg exit code ${result.status}`).trim(),
    };
};
const extractAudioSegment = (videoPath, audioPath, startTime, endTime) => {
    const normalizedStart = Number(startTime);
    const normalizedEnd = Number(endTime);
    if (!Number.isFinite(normalizedStart) || !Number.isFinite(normalizedEnd) || normalizedEnd <= normalizedStart) {
        throw new Error(`Invalid segment window: start=${startTime} end=${endTime}`);
    }
    const duration = normalizedEnd - normalizedStart;
    const commands = [
        [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-ss",
            String(normalizedStart),
            "-i",
            videoPath,
            "-t",
            String(duration),
            "-vn",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "2",
            audioPath,
        ],
        [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            videoPath,
            "-ss",
            String(normalizedStart),
            "-to",
            String(normalizedEnd),
            "-vn",
            "-acodec",
            "libmp3lame",
            "-q:a",
            "2",
            audioPath,
        ],
    ];
    let lastError = "Unknown ffmpeg error";
    for (const command of commands) {
        const result = runFfmpegCommand(command);
        if (result.ok && node_fs_1.default.existsSync(audioPath) && node_fs_1.default.statSync(audioPath).size > 0) {
            return;
        }
        lastError = result.errorText;
    }
    throw new Error(`FFmpeg extraction failed: ${lastError}`);
};
exports.extractAudioSegment = extractAudioSegment;
const extractAudioFile = (videoPath, audioPath) => {
    const command = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-q:a",
        "2",
        audioPath,
    ];
    const result = runFfmpegCommand(command);
    if (!result.ok) {
        throw new Error(`FFmpeg full audio extraction failed: ${result.errorText}`);
    }
};
exports.extractAudioFile = extractAudioFile;
const splitAudioIntoChunks = (audioPath, chunkDurationSeconds = 600) => {
    const duration = (0, exports.getMediaDuration)(audioPath);
    if (!duration || duration <= chunkDurationSeconds) {
        return [audioPath];
    }
    const audioDir = node_path_1.default.dirname(audioPath);
    const base = node_path_1.default.parse(audioPath).name;
    const chunks = [];
    let start = 0;
    let index = 0;
    while (start < duration) {
        const chunkPath = node_path_1.default.join(audioDir, `${base}_part_${index}.mp3`);
        const result = runFfmpegCommand([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            audioPath,
            "-ss",
            String(start),
            "-t",
            String(chunkDurationSeconds),
            "-c",
            "copy",
            chunkPath,
        ]);
        if (!result.ok) {
            throw new Error(`Chunking failed at index ${index}: ${result.errorText}`);
        }
        if (node_fs_1.default.existsSync(chunkPath) && node_fs_1.default.statSync(chunkPath).size > 0) {
            chunks.push(chunkPath);
        }
        start += chunkDurationSeconds;
        index += 1;
    }
    return chunks.length > 0 ? chunks : [audioPath];
};
exports.splitAudioIntoChunks = splitAudioIntoChunks;
const formatTimestampClean = (secondsInput) => {
    const seconds = Math.max(0, Math.floor(secondsInput));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
};
exports.formatTimestampClean = formatTimestampClean;
const mistralSegmentsToCleanText = (segments, offsetSeconds = 0) => {
    return segments
        .map((segment) => {
        const timestamp = (0, exports.formatTimestampClean)(segment.start + offsetSeconds);
        const text = segment.text.trim();
        return `[${timestamp}]  ${text}`;
    })
        .join("\n");
};
exports.mistralSegmentsToCleanText = mistralSegmentsToCleanText;
const cleanTranscriptHallucinations = (transcript) => {
    const lines = transcript.split("\n");
    const cleaned = [];
    let lastNorm = "";
    let repeatCount = 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const match = line.match(/(\[.*?\]|\d{2}:\d{2}:\d{2}.*?)\s*(.*)/);
        if (!match) {
            cleaned.push(line);
            continue;
        }
        const textRaw = (match[2] ?? "").trim();
        const textNorm = textRaw.toLowerCase().replace(/[^\w]/g, "");
        if (!textNorm)
            continue;
        if (textNorm === lastNorm) {
            repeatCount += 1;
        }
        else {
            repeatCount = 0;
            lastNorm = textNorm;
        }
        if (repeatCount < 2) {
            cleaned.push(line);
        }
    }
    return cleaned.join("\n");
};
exports.cleanTranscriptHallucinations = cleanTranscriptHallucinations;
