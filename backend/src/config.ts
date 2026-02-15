import fs from "node:fs";

export const PRODUCT_OPTIONS = [
  "Intensive",
  "Academy",
  "External",
  "Academy Edge",
  "Nxtwave Edge",
  "NIAT",
  "Intensive Offline",
  "Experienced Hiring",
] as const;

export const GSHEET_ID = process.env.GSHEET_ID ?? "1HgOg9AS2fJ5UIyvkg3eJlaIm38MSunoW-bcOcagYc1c";

export const SHEET_NAMES = {
  interview: "interview_Q&A",
  drilldown: "Drill_Q&A",
  assessments: "Assess_Q&A",
  assignments: "Assign_Q&A",
} as const;

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const MISTRAL_CHAT_MIN_INTERVAL_SECONDS = parseNumber(
  process.env.MISTRAL_CHAT_MIN_INTERVAL_SECONDS,
  1.2,
);

export const MISTRAL_CHAT_MAX_RETRIES_PER_KEY = parseNumber(
  process.env.MISTRAL_CHAT_MAX_RETRIES_PER_KEY,
  4,
);

export const QNA_CHUNK_SIZE = parseNumber(process.env.QNA_CHUNK_SIZE, 18000);
export const QNA_CHUNK_OVERLAP = parseNumber(process.env.QNA_CHUNK_OVERLAP, 1200);

export const APP_DIRS = {
  downloadedVideos: "DownloadedVideos",
  generatedTranscripts: "GeneratedTranscripts",
  qa: "Q&A",
  audioChunks: "AudioChunks",
} as const;

export type ServiceAccountCredentials = {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
};

const getFirstEnv = (keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }
  return undefined;
};

const normalizePrivateKey = (value: string | undefined): string | undefined => {
  if (!value) return value;
  return value.replace(/\\n/g, "\n");
};

const getInlineServiceAccountFromEnv = (): ServiceAccountCredentials | null => {
  // Supports both recommended prefixed env vars and Streamlit-style plain keys.
  const creds: ServiceAccountCredentials = {
    type: getFirstEnv(["GCP_TYPE", "type"]) ?? "",
    project_id: getFirstEnv(["GCP_PROJECT_ID", "project_id"]) ?? "",
    private_key_id: getFirstEnv(["GCP_PRIVATE_KEY_ID", "private_key_id"]) ?? "",
    private_key: normalizePrivateKey(getFirstEnv(["GCP_PRIVATE_KEY", "private_key"])) ?? "",
    client_email: getFirstEnv(["GCP_CLIENT_EMAIL", "client_email"]) ?? "",
    client_id: getFirstEnv(["GCP_CLIENT_ID", "client_id"]) ?? "",
    auth_uri: getFirstEnv(["GCP_AUTH_URI", "auth_uri"]) ?? "",
    token_uri: getFirstEnv(["GCP_TOKEN_URI", "token_uri"]) ?? "",
    auth_provider_x509_cert_url:
      getFirstEnv(["GCP_AUTH_PROVIDER_X509_CERT_URL", "auth_provider_x509_cert_url"]) ?? "",
    client_x509_cert_url: getFirstEnv(["GCP_CLIENT_X509_CERT_URL", "client_x509_cert_url"]) ?? "",
    universe_domain: getFirstEnv(["GCP_UNIVERSE_DOMAIN", "universe_domain"]),
  };

  const requiredFields: Array<keyof ServiceAccountCredentials> = [
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

export const getServiceAccountCredentials = (): ServiceAccountCredentials | null => {
  const json = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json) as ServiceAccountCredentials;
      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(parsed.private_key) ?? "";
      }
      return parsed;
    } catch {
      return null;
    }
  }

  const filePath = process.env.GCP_SERVICE_ACCOUNT_FILE;
  if (filePath && fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(data) as ServiceAccountCredentials;
      if (parsed.private_key) {
        parsed.private_key = normalizePrivateKey(parsed.private_key) ?? "";
      }
      return parsed;
    } catch {
      return null;
    }
  }

  return getInlineServiceAccountFromEnv();
};

export const getMistralChatKeys = (): string[] => {
  const keys = [
    process.env.MISTRAL_API_KEY_1,
    process.env.MISTRAL_API_KEY_2,
    process.env.MISTRAL_API_KEY_3,
    process.env.MISTRAL_API_KEY_4,
    process.env.MISTRAL_API_KEY,
  ].filter((value): value is string => Boolean(value));

  return keys;
};

export const getMistralTranscribeKey = (): string | null => {
  return process.env.MISTRAL_TRANSCRIBE_API_KEY ?? process.env.MISTRAL_API_KEY ?? null;
};

export const GITHUB_GIST_TOKEN = process.env.GITHUB_GIST_TOKEN ?? null;

export const MISTRAL_URLS = {
  chat: "https://api.mistral.ai/v1/chat/completions",
  ocr: "https://api.mistral.ai/v1/ocr",
  transcribe: "https://api.mistral.ai/v1/audio/transcriptions",
} as const;

export const MISTRAL_MODELS = {
  chat: "mistral-large-latest",
  ocr: "mistral-ocr-latest",
  transcribe: "voxtral-mini-latest",
} as const;
