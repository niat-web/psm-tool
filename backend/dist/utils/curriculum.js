"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurriculumSnippet = exports.getCurriculumText = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const pdf_parse_1 = require("pdf-parse");
let cachedCurriculumText = null;
const getCurriculumText = async () => {
    if (cachedCurriculumText !== null) {
        return cachedCurriculumText;
    }
    const pdfPath = node_path_1.default.resolve(process.cwd(), "curriculum.pdf");
    if (!node_fs_1.default.existsSync(pdfPath)) {
        cachedCurriculumText = "";
        return cachedCurriculumText;
    }
    try {
        const fileBuffer = node_fs_1.default.readFileSync(pdfPath);
        const parser = new pdf_parse_1.PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        await parser.destroy();
        cachedCurriculumText = parsed.text?.trim() ?? "";
    }
    catch {
        cachedCurriculumText = "";
    }
    return cachedCurriculumText ?? "";
};
exports.getCurriculumText = getCurriculumText;
const getCurriculumSnippet = async (maxLength = 15000) => {
    const text = await (0, exports.getCurriculumText)();
    return text.slice(0, maxLength);
};
exports.getCurriculumSnippet = getCurriculumSnippet;
