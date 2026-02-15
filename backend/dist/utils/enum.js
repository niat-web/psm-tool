"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceEnumFormat = void 0;
const isEmptyLike = (value) => {
    if (value === null || value === undefined)
        return true;
    const normalized = String(value).trim().toUpperCase();
    return normalized.length === 0 || ["N/A", "NAN", "NONE", "NULL"].includes(normalized);
};
const normalizeSingle = (value) => {
    if (isEmptyLike(value))
        return null;
    return String(value)
        .toUpperCase()
        .trim()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
};
const forceEnumFormat = (value) => {
    if (Array.isArray(value)) {
        const normalized = value.map(normalizeSingle).filter((entry) => Boolean(entry));
        return normalized.length > 0 ? normalized.join(", ") : "N/A";
    }
    const normalized = normalizeSingle(value);
    return normalized && normalized.length > 0 ? normalized : "N/A";
};
exports.forceEnumFormat = forceEnumFormat;
