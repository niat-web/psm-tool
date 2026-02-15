"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublicGist = void 0;
const config_1 = require("../config");
const GIST_API_URL = "https://api.github.com/gists";
const createPublicGist = async (fileName, content) => {
    if (!config_1.GITHUB_GIST_TOKEN) {
        return "Gist Token Missing";
    }
    try {
        const response = await fetch(GIST_API_URL, {
            method: "POST",
            headers: {
                Authorization: `token ${config_1.GITHUB_GIST_TOKEN}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                description: `Transcript for ${fileName}`,
                public: true,
                files: {
                    [fileName]: {
                        content,
                    },
                },
            }),
        });
        if (response.status === 201) {
            const json = await response.json();
            return String(json?.html_url ?? "Error retrieving URL");
        }
        return `Error: ${response.status}`;
    }
    catch (error) {
        return `Upload Failed: ${String(error)}`;
    }
};
exports.createPublicGist = createPublicGist;
