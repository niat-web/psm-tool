"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRemoveDir = exports.safeRemoveFile = exports.writeTextFile = exports.readTextFileIfExists = exports.ensureDirs = exports.ensureDir = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ensureDir = (dirPath) => {
    if (!node_fs_1.default.existsSync(dirPath)) {
        node_fs_1.default.mkdirSync(dirPath, { recursive: true });
    }
};
exports.ensureDir = ensureDir;
const ensureDirs = (dirs) => {
    for (const dir of dirs) {
        (0, exports.ensureDir)(dir);
    }
};
exports.ensureDirs = ensureDirs;
const readTextFileIfExists = (filePath) => {
    if (!node_fs_1.default.existsSync(filePath))
        return "";
    return node_fs_1.default.readFileSync(filePath, "utf8");
};
exports.readTextFileIfExists = readTextFileIfExists;
const writeTextFile = (filePath, content) => {
    (0, exports.ensureDir)(node_path_1.default.dirname(filePath));
    node_fs_1.default.writeFileSync(filePath, content, "utf8");
};
exports.writeTextFile = writeTextFile;
const safeRemoveFile = (filePath) => {
    try {
        if (node_fs_1.default.existsSync(filePath))
            node_fs_1.default.unlinkSync(filePath);
    }
    catch {
        // Ignore cleanup failures.
    }
};
exports.safeRemoveFile = safeRemoveFile;
const safeRemoveDir = (dirPath) => {
    try {
        if (node_fs_1.default.existsSync(dirPath))
            node_fs_1.default.rmSync(dirPath, { recursive: true, force: true });
    }
    catch {
        // Ignore cleanup failures.
    }
};
exports.safeRemoveDir = safeRemoveDir;
