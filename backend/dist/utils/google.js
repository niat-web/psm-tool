"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDriveFileToPath = exports.appendRowsWithHeaders = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const googleapis_1 = require("googleapis");
const config_1 = require("../config");
const fs_1 = require("./fs");
const DEFAULT_SHEETS_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.readonly",
];
const DEFAULT_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];
const getAuthClient = (scopes) => {
    const credentials = (0, config_1.getServiceAccountCredentials)();
    if (!credentials) {
        return null;
    }
    return new googleapis_1.google.auth.GoogleAuth({
        credentials,
        scopes,
    });
};
const getSheets = () => {
    const auth = getAuthClient(DEFAULT_SHEETS_SCOPES);
    if (!auth)
        return null;
    return googleapis_1.google.sheets({ version: "v4", auth });
};
const getDrive = () => {
    const auth = getAuthClient(DEFAULT_DRIVE_SCOPES);
    if (!auth)
        return null;
    return googleapis_1.google.drive({ version: "v3", auth });
};
const ensureSheetExists = async (sheets, sheetName) => {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: config_1.GSHEET_ID });
    const found = metadata.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);
    if (found)
        return;
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config_1.GSHEET_ID,
        requestBody: {
            requests: [
                {
                    addSheet: {
                        properties: {
                            title: sheetName,
                        },
                    },
                },
            ],
        },
    });
};
const normalizeRows = (rows, headers) => {
    return rows.map((row) => headers.map((header) => String(row[header] ?? "N/A")));
};
const appendRowsWithHeaders = async (args) => {
    if (args.rows.length === 0) {
        return true;
    }
    const sheets = getSheets();
    if (!sheets) {
        return false;
    }
    try {
        await ensureSheetExists(sheets, args.sheetName);
        const headerRange = `${args.sheetName}!1:1`;
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: config_1.GSHEET_ID,
            range: headerRange,
        });
        const currentHeaders = headerResponse.data.values?.[0] ?? [];
        const incomingHeaders = args.headers;
        const isHeaderExact = currentHeaders.length === incomingHeaders.length &&
            currentHeaders.every((header, index) => header === incomingHeaders[index]);
        if (!isHeaderExact) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: config_1.GSHEET_ID,
                range: `${args.sheetName}!A1`,
                valueInputOption: "RAW",
                requestBody: {
                    values: [incomingHeaders],
                },
            });
        }
        const values = normalizeRows(args.rows, incomingHeaders);
        await sheets.spreadsheets.values.append({
            spreadsheetId: config_1.GSHEET_ID,
            range: `${args.sheetName}!A2`,
            valueInputOption: "RAW",
            requestBody: {
                values,
            },
        });
        return true;
    }
    catch {
        return false;
    }
};
exports.appendRowsWithHeaders = appendRowsWithHeaders;
const downloadDriveFileToPath = async (fileId, outputPath) => {
    const drive = getDrive();
    if (!drive) {
        return "Credentials Error";
    }
    try {
        (0, fs_1.ensureDir)(node_path_1.default.dirname(outputPath));
        const response = await drive.files.get({
            fileId,
            alt: "media",
        }, {
            responseType: "stream",
        });
        await new Promise((resolve, reject) => {
            const stream = node_fs_1.default.createWriteStream(outputPath);
            response.data
                .on("end", () => resolve())
                .on("error", (error) => reject(error))
                .pipe(stream);
        });
        return "Success";
    }
    catch (error) {
        const text = String(error);
        if (text.includes("File not found")) {
            return "File Not Found (Check Sharing)";
        }
        return text;
    }
};
exports.downloadDriveFileToPath = downloadDriveFileToPath;
