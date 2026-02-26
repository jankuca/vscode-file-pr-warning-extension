"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.AuthError = exports.GitHubClient = void 0;
const vscode = __importStar(require("vscode"));
const queries_1 = require("./queries");
const diffParser_1 = require("../core/diffParser");
const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_API_URL = 'https://api.github.com';
class GitHubClient {
    rateLimitState = { remaining: null, resetAt: null };
    get rateLimit() {
        return { ...this.rateLimitState };
    }
    isRateLimited() {
        if (this.rateLimitState.remaining === null) {
            return false;
        }
        if (this.rateLimitState.remaining > 0) {
            return false;
        }
        if (this.rateLimitState.resetAt && Date.now() > this.rateLimitState.resetAt) {
            return false; // Reset time has passed
        }
        return true;
    }
    async fetchOpenPRs(owner, repo, token) {
        if (this.isRateLimited()) {
            const resetAt = this.rateLimitState.resetAt;
            const retryIn = resetAt ? Math.ceil((resetAt - Date.now()) / 60000) : '?';
            throw new RateLimitError(`GitHub API rate limit exceeded. Resets in ~${retryIn} min.`);
        }
        const prs = [];
        let cursor = null;
        do {
            const variables = { owner, repo };
            if (cursor) {
                variables.cursor = cursor;
            }
            const response = await fetch(GITHUB_GRAPHQL_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query: queries_1.OPEN_PRS_QUERY, variables }),
            });
            this.updateRateLimit(response.headers);
            if (response.status === 401) {
                throw new AuthError('GitHub token is invalid or expired');
            }
            if (response.status === 403 && this.rateLimitState.remaining === 0) {
                throw new RateLimitError('GitHub API rate limit exceeded');
            }
            if (!response.ok) {
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
            }
            const json = (await response.json());
            if (json.errors?.length) {
                throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
            }
            const data = json.data.repository.pullRequests;
            for (const node of data.nodes) {
                prs.push(this.mapNodeToPR(node));
            }
            cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
        } while (cursor);
        return prs;
    }
    async fetchFileDiff(owner, repo, prNumber, filePath, token) {
        if (this.isRateLimited()) {
            return [];
        }
        const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
        });
        this.updateRateLimit(response.headers);
        if (response.status === 401) {
            throw new AuthError('GitHub token is invalid or expired');
        }
        if (!response.ok) {
            return [];
        }
        const files = (await response.json());
        const file = files.find(f => f.filename === filePath);
        if (!file || !file.patch) {
            return [];
        }
        return (0, diffParser_1.parsePatchToLineRanges)(file.patch);
    }
    mapNodeToPR(node) {
        return {
            number: node.number,
            title: node.title,
            url: node.url,
            author: node.author?.login ?? 'unknown',
            headRefName: node.headRefName,
            isDraft: node.isDraft,
            createdAt: node.createdAt,
            updatedAt: node.updatedAt,
            files: node.files.nodes.map(f => f.path),
            filesIncomplete: node.files.pageInfo.hasNextPage,
        };
    }
    updateRateLimit(headers) {
        const remaining = headers.get('X-RateLimit-Remaining');
        const reset = headers.get('X-RateLimit-Reset');
        if (remaining !== null) {
            this.rateLimitState.remaining = parseInt(remaining, 10);
        }
        if (reset !== null) {
            this.rateLimitState.resetAt = parseInt(reset, 10) * 1000;
        }
        // Warn when rate limit is getting low
        if (this.rateLimitState.remaining !== null && this.rateLimitState.remaining < 100 && this.rateLimitState.remaining > 0) {
            if (this.rateLimitState.remaining % 50 === 0) {
                vscode.window.showWarningMessage(`File PR Warning: GitHub API rate limit low (${this.rateLimitState.remaining} remaining)`);
            }
        }
    }
}
exports.GitHubClient = GitHubClient;
class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthError';
    }
}
exports.AuthError = AuthError;
class RateLimitError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=githubClient.js.map