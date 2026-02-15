"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MISTRAL_MODELS = exports.MISTRAL_URLS = exports.GITHUB_GIST_TOKEN = exports.getMistralTranscribeKey = exports.getMistralChatKeys = exports.getServiceAccountCredentials = exports.APP_DIRS = exports.QNA_CHUNK_OVERLAP = exports.QNA_CHUNK_SIZE = exports.MISTRAL_CHAT_MAX_RETRIES_PER_KEY = exports.MISTRAL_CHAT_MIN_INTERVAL_SECONDS = exports.SHEET_NAMES = exports.GSHEET_ID = exports.PRODUCT_OPTIONS = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
exports.PRODUCT_OPTIONS = [
    "Intensive",
    "Academy",
    "External",
    "Academy Edge",
    "Nxtwave Edge",
    "NIAT",
    "Intensive Offline",
    "Experienced Hiring",
];
exports.GSHEET_ID = process.env.GSHEET_ID ?? "1HgOg9AS2fJ5UIyvkg3eJlaIm38MSunoW-bcOcagYc1c";
exports.SHEET_NAMES = {
    interview: "interview_Q&A",
    drilldown: "Drill_Q&A",
    assessments: "Assess_Q&A",
    assignments: "Assign_Q&A",
};
const parseNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.MISTRAL_CHAT_MIN_INTERVAL_SECONDS = parseNumber(process.env.MISTRAL_CHAT_MIN_INTERVAL_SECONDS, 1.2);
exports.MISTRAL_CHAT_MAX_RETRIES_PER_KEY = parseNumber(process.env.MISTRAL_CHAT_MAX_RETRIES_PER_KEY, 4);
exports.QNA_CHUNK_SIZE = parseNumber(process.env.QNA_CHUNK_SIZE, 18000);
exports.QNA_CHUNK_OVERLAP = parseNumber(process.env.QNA_CHUNK_OVERLAP, 1200);
exports.APP_DIRS = {
    downloadedVideos: "DownloadedVideos",
    generatedTranscripts: "GeneratedTranscripts",
    qa: "Q&A",
    audioChunks: "AudioChunks",
};
const getFirstEnv = (keys) => {
    for (const key of keys) {
        const value = process.env[key];
        if (value !== undefined && value !== "") {
            return value;
        }
    }
    return undefined;
};
const normalizePrivateKey = (value) => {
    if (!value)
        return value;
    return value.replace(/\\n/g, "\n");
};
const getInlineServiceAccountFromEnv = () => {
    // Supports both recommended prefixed env vars and Streamlit-style plain keys.
    const creds = {
        type: getFirstEnv(["GCP_TYPE", "type"]) ?? "",
        project_id: getFirstEnv(["GCP_PROJECT_ID", "project_id"]) ?? "",
        private_key_id: getFirstEnv(["GCP_PRIVATE_KEY_ID", "private_key_id"]) ?? "",
        private_key: normalizePrivateKey(getFirstEnv(["GCP_PRIVATE_KEY", "private_key"])) ?? "",
        client_email: getFirstEnv(["GCP_CLIENT_EMAIL", "client_email"]) ?? "",
        client_id: getFirstEnv(["GCP_CLIENT_ID", "client_id"]) ?? "",
        auth_uri: getFirstEnv(["GCP_AUTH_URI", "auth_uri"]) ?? "",
        token_uri: getFirstEnv(["GCP_TOKEN_URI", "token_uri"]) ?? "",
        auth_provider_x509_cert_url: getFirstEnv(["GCP_AUTH_PROVIDER_X509_CERT_URL", "auth_provider_x509_cert_url"]) ?? "",
        client_x509_cert_url: getFirstEnv(["GCP_CLIENT_X509_CERT_URL", "client_x509_cert_url"]) ?? "",
        universe_domain: getFirstEnv(["GCP_UNIVERSE_DOMAIN", "universe_domain"]),
    };
    const requiredFields = [
        "type",
        "project_id",
        "private_key_id",
        "private_key",
        "client_email",
        "client_id",
        "auth_uri",
        "token_uri",
        "auth_provider_x509_cert_url",
        "client_x509_cert_url",
    ];
    const hasAllRequired = requiredFields.every((field) => {
        const value = creds[field];
        return typeof value === "string" && value.trim().length > 0;
    });
    return hasAllRequired ? creds : null;
};
const getServiceAccountCredentials = () => {
    const json = process.env.GCP_SERVICE_ACCOUNT_JSON;
    if (json) {
        try {
            const parsed = JSON.parse(json);
            if (parsed.private_key) {
                parsed.private_key = normalizePrivateKey(parsed.private_key) ?? "";
            }
            return parsed;
        }
        catch {
            return null;
        }
    }
    const filePath = process.env.GCP_SERVICE_ACCOUNT_FILE;
    if (filePath && node_fs_1.default.existsSync(filePath)) {
        try {
            const data = node_fs_1.default.readFileSync(filePath, "utf8");
            const parsed = JSON.parse(data);
            if (parsed.private_key) {
                parsed.private_key = normalizePrivateKey(parsed.private_key) ?? "";
            }
            return parsed;
        }
        catch {
            return null;
        }
    }
    return getInlineServiceAccountFromEnv();
};
exports.getServiceAccountCredentials = getServiceAccountCredentials;
const getMistralChatKeys = () => {
    const keys = [
        process.env.MISTRAL_API_KEY_1,
        process.env.MISTRAL_API_KEY_2,
        process.env.MISTRAL_API_KEY_3,
        process.env.MISTRAL_API_KEY_4,
        process.env.MISTRAL_API_KEY,
    ].filter((value) => Boolean(value));
    return keys;
};
exports.getMistralChatKeys = getMistralChatKeys;
const getMistralTranscribeKey = () => {
    return process.env.MISTRAL_TRANSCRIBE_API_KEY ?? process.env.MISTRAL_API_KEY ?? null;
};
exports.getMistralTranscribeKey = getMistralTranscribeKey;
exports.GITHUB_GIST_TOKEN = process.env.GITHUB_GIST_TOKEN ?? null;
exports.MISTRAL_URLS = {
    chat: "https://api.mistral.ai/v1/chat/completions",
    ocr: "https://api.mistral.ai/v1/ocr",
    transcribe: "https://api.mistral.ai/v1/audio/transcriptions",
};
exports.MISTRAL_MODELS = {
    chat: "mistral-large-latest",
    ocr: "mistral-ocr-latest",
    transcribe: "voxtral-mini-latest",
};
