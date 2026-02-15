"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mistralTranscribeAudio = exports.mistralOcr = exports.mistralJsonAsArray = exports.mistralChatJson = exports.mistralChat = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("../config");
let chatKeyIndex = 0;
let lastChatCallTs = 0;
const parseMaybeJson = (input) => {
    const cleaned = input.replace(/```json/gi, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(cleaned);
    }
    catch {
        return cleaned;
    }
};
const computeRetryWaitSeconds = (attempt, retryAfterHeader) => {
    if (retryAfterHeader) {
        const parsed = Number(retryAfterHeader);
        if (Number.isFinite(parsed) && parsed > 0) {
            return Math.min(parsed, 30);
        }
    }
    return Math.min(2 ** attempt + Math.random() * 0.7 + 0.2, 30);
};
const sleep = async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
};
const throttleChat = async () => {
    const now = Date.now();
    const elapsed = (now - lastChatCallTs) / 1000;
    const waitSeconds = config_1.MISTRAL_CHAT_MIN_INTERVAL_SECONDS - elapsed;
    if (waitSeconds > 0) {
        await sleep(waitSeconds * 1000);
    }
    lastChatCallTs = Date.now();
};
const getRotatedChatKeys = () => {
    const keys = (0, config_1.getMistralChatKeys)();
    if (keys.length === 0)
        return [];
    const rotated = [...keys];
    const offset = chatKeyIndex % keys.length;
    if (offset > 0) {
        rotated.push(...rotated.splice(0, offset));
    }
    chatKeyIndex += 1;
    return rotated;
};
const extractChatContent = (responseJson) => {
    return responseJson?.choices?.[0]?.message?.content ?? "";
};
const mistralChat = async (messages, options = {}) => {
    const keys = getRotatedChatKeys();
    if (keys.length === 0) {
        throw new Error("No Mistral API keys configured.");
    }
    const payload = {
        model: config_1.MISTRAL_MODELS.chat,
        messages,
        temperature: options.temperature ?? 0.1,
    };
    if (options.responseAsJsonObject) {
        payload.response_format = { type: "json_object" };
    }
    const maxRetriesPerKey = options.maxRetriesPerKey ?? config_1.MISTRAL_CHAT_MAX_RETRIES_PER_KEY;
    const timeoutMs = options.timeoutMs ?? 120000;
    let lastError = new Error("Unknown Mistral error");
    for (const key of keys) {
        for (let attempt = 0; attempt < maxRetriesPerKey; attempt += 1) {
            try {
                await throttleChat();
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), timeoutMs);
                const response = await fetch(config_1.MISTRAL_URLS.chat, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${key}`,
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                if ([429, 500, 502, 503, 504].includes(response.status)) {
                    const waitSeconds = computeRetryWaitSeconds(attempt, response.headers.get("Retry-After"));
                    await sleep(waitSeconds * 1000);
                    lastError = new Error(`${response.status} ${response.statusText}`);
                    continue;
                }
                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`${response.status}: ${text}`);
                }
                const json = await response.json();
                return extractChatContent(json);
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetriesPerKey - 1) {
                    const waitSeconds = computeRetryWaitSeconds(attempt);
                    await sleep(waitSeconds * 1000);
                    continue;
                }
            }
        }
    }
    throw new Error(`Mistral chat failed after retries: ${String(lastError)}`);
};
exports.mistralChat = mistralChat;
const mistralChatJson = async (messages, options = {}) => {
    const content = await (0, exports.mistralChat)(messages, {
        ...options,
        responseAsJsonObject: options.responseAsJsonObject ?? true,
    });
    return parseMaybeJson(content);
};
exports.mistralChatJson = mistralChatJson;
const mistralJsonAsArray = async (messages, options = {}) => {
    const parsed = await (0, exports.mistralChatJson)(messages, options);
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
};
exports.mistralJsonAsArray = mistralJsonAsArray;
const mimeFromExtension = (fileName) => {
    const ext = node_path_1.default.extname(fileName).toLowerCase();
    switch (ext) {
        case ".pdf":
            return "application/pdf";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".webp":
            return "image/webp";
        case ".tiff":
            return "image/tiff";
        case ".bmp":
            return "image/bmp";
        default:
            return "application/octet-stream";
    }
};
const mistralOcr = async (args) => {
    const keys = getRotatedChatKeys();
    if (keys.length === 0) {
        return { fullText: "", imageIds: [] };
    }
    const mimeType = args.mimeType ?? mimeFromExtension(args.fileName);
    const base64 = args.fileBuffer.toString("base64");
    for (const key of keys) {
        try {
            const response = await fetch(config_1.MISTRAL_URLS.ocr, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: config_1.MISTRAL_MODELS.ocr,
                    document: {
                        type: "image_url",
                        image_url: `data:${mimeType};base64,${base64}`,
                    },
                    include_image_base64: false,
                }),
            });
            if (!response.ok) {
                continue;
            }
            const json = await response.json();
            const pages = Array.isArray(json?.pages) ? json.pages : [];
            const fullText = pages
                .map((page) => String(page?.markdown ?? ""))
                .join("\n\n")
                .trim();
            const imageIds = pages.flatMap((page) => {
                const images = Array.isArray(page?.images) ? page.images : [];
                return images.map((image) => String(image?.id ?? "unknown"));
            });
            return { fullText, imageIds };
        }
        catch {
            // Try next key.
        }
    }
    return { fullText: "", imageIds: [] };
};
exports.mistralOcr = mistralOcr;
const mistralTranscribeAudio = async (audioPath) => {
    const key = (0, config_1.getMistralTranscribeKey)();
    if (!key) {
        throw new Error("No Mistral transcribe key configured.");
    }
    if (!node_fs_1.default.existsSync(audioPath)) {
        throw new Error(`Audio file not found: ${audioPath}`);
    }
    const form = new FormData();
    const audioBuffer = node_fs_1.default.readFileSync(audioPath);
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    form.append("file", audioBlob, node_path_1.default.basename(audioPath));
    form.append("model", config_1.MISTRAL_MODELS.transcribe);
    form.append("timestamp_granularities", "segment");
    form.append("response_format", "verbose_json");
    const response = await fetch(config_1.MISTRAL_URLS.transcribe, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
        },
        body: form,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Transcription failed: ${response.status} ${text}`);
    }
    const json = await response.json();
    const segments = Array.isArray(json?.segments) ? json.segments : [];
    return segments
        .map((segment) => ({
        start: Number(segment?.start ?? 0),
        end: Number(segment?.end ?? 0),
        text: String(segment?.text ?? "").trim(),
    }))
        .filter((segment) => segment.text.length > 0);
};
exports.mistralTranscribeAudio = mistralTranscribeAudio;
