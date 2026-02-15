"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadClassifyPromptTemplate = exports.loadQnaPrompt = exports.loadPromptFile = void 0;
const node_path_1 = __importDefault(require("node:path"));
const fs_1 = require("./fs");
const PROMPT_DIR = node_path_1.default.resolve(process.cwd(), "backend", "prompts");
const loadPromptFile = (fileName) => {
    const fullPath = node_path_1.default.join(PROMPT_DIR, fileName);
    return (0, fs_1.readTextFileIfExists)(fullPath).trim();
};
exports.loadPromptFile = loadPromptFile;
const loadQnaPrompt = () => (0, exports.loadPromptFile)("q&a.txt");
exports.loadQnaPrompt = loadQnaPrompt;
const loadClassifyPromptTemplate = () => (0, exports.loadPromptFile)("classify.txt");
exports.loadClassifyPromptTemplate = loadClassifyPromptTemplate;
