"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = exports.logInfo = void 0;
const logInfo = (message, payload) => {
    if (payload === undefined) {
        // eslint-disable-next-line no-console
        console.log(`[INFO] ${message}`);
        return;
    }
    // eslint-disable-next-line no-console
    console.log(`[INFO] ${message}`, payload);
};
exports.logInfo = logInfo;
const logError = (message, payload) => {
    if (payload === undefined) {
        // eslint-disable-next-line no-console
        console.error(`[ERROR] ${message}`);
        return;
    }
    // eslint-disable-next-line no-console
    console.error(`[ERROR] ${message}`, payload);
};
exports.logError = logError;
