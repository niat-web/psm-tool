import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import { GSHEET_ID, getServiceAccountCredentials } from "../config";
import { ensureDir } from "./fs";

const DEFAULT_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
];

const DEFAULT_DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"];

const getAuthClient = (scopes: string[]) => {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    return null;
  }

  return new google.auth.GoogleAuth({
    credentials,
    scopes,
  });
};

const getSheets = () => {
  const auth = getAuthClient(DEFAULT_SHEETS_SCOPES);
  if (!auth) return null;
  return google.sheets({ version: "v4", auth });
};

const getDrive = () => {
  const auth = getAuthClient(DEFAULT_DRIVE_SCOPES);
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
};

const ensureSheetExists = async (sheets: ReturnType<typeof google.sheets>, sheetName: string): Promise<void> => {
  const metadata = await sheets.spreadsheets.get({ spreadsheetId: GSHEET_ID });
  const found = metadata.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);

  if (found) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: GSHEET_ID,
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

const normalizeRows = (rows: Record<string, unknown>[], headers: string[]): string[][] => {
  return rows.map((row) => headers.map((header) => String(row[header] ?? "N/A")));
};

export const appendRowsWithHeaders = async (args: {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}): Promise<boolean> => {
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
      spreadsheetId: GSHEET_ID,
      range: headerRange,
    });

    const currentHeaders = headerResponse.data.values?.[0] ?? [];
    const incomingHeaders = args.headers;
    const isHeaderExact =
      currentHeaders.length === incomingHeaders.length &&
      currentHeaders.every((header, index) => header === incomingHeaders[index]);

    if (!isHeaderExact) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: GSHEET_ID,
        range: `${args.sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [incomingHeaders],
        },
      });
    }

    const values = normalizeRows(args.rows, incomingHeaders);

    await sheets.spreadsheets.values.append({
      spreadsheetId: GSHEET_ID,
      range: `${args.sheetName}!A2`,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    });

    return true;
  } catch {
    return false;
  }
};

export const downloadDriveFileToPath = async (fileId: string, outputPath: string): Promise<string> => {
  const drive = getDrive();
  if (!drive) {
    return "Credentials Error";
  }

  try {
    ensureDir(path.dirname(outputPath));

    const response = await drive.files.get(
      {
        fileId,
        alt: "media",
      },
      {
        responseType: "stream",
      },
    );

    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      response.data
        .on("end", () => resolve())
        .on("error", (error: unknown) => reject(error))
        .pipe(stream);
    });

    return "Success";
  } catch (error) {
    const text = String(error);
    if (text.includes("File not found")) {
      return "File Not Found (Check Sharing)";
    }
    return text;
  }
};
