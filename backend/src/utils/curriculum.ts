import fs from "node:fs";
import path from "node:path";
import { PDFParse } from "pdf-parse";

let cachedCurriculumText: string | null = null;

export const getCurriculumText = async (): Promise<string> => {
  if (cachedCurriculumText !== null) {
    return cachedCurriculumText;
  }

  const pdfPath = path.resolve(process.cwd(), "curriculum.pdf");
  if (!fs.existsSync(pdfPath)) {
    cachedCurriculumText = "";
    return cachedCurriculumText;
  }

  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    await parser.destroy();
    cachedCurriculumText = parsed.text?.trim() ?? "";
  } catch {
    cachedCurriculumText = "";
  }

  return cachedCurriculumText ?? "";
};

export const getCurriculumSnippet = async (maxLength = 15000): Promise<string> => {
  const text = await getCurriculumText();
  return text.slice(0, maxLength);
};
