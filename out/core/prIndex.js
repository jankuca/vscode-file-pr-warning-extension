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
exports.PRIndex = void 0;
const vscode = __importStar(require("vscode"));
const diffParser_1 = require("./diffParser");
const githubClient_1 = require("../github/githubClient");
class PRIndex {
    gitService;
    authService;
    githubClient;
    cache = new Map();
    fetchingPromise = null;
    refreshTimer;
    disposables = [];
    _onDidChangeData = new vscode.EventEmitter();
    onDidChangeData = this._onDidChangeData.event;
    constructor(gitService, authService, githubClient) {
        this.gitService = gitService;
        this.authService = authService;
        this.githubClient = githubClient;
        // Re-filter on branch change (no re-fetch needed)
        this.disposables.push(this.gitService.onDidChangeBranch(() => {
            this._onDidChangeData.fire();
        }));
    }
    startAutoRefresh(intervalMinutes) {
        this.stopAutoRefresh();
        const ms = intervalMinutes * 60 * 1000;
        this.refreshTimer = setInterval(() => {
            this.refreshAll();
        }, ms);
    }
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }
    getRelativePath(uri) {
        return this.gitService.getRepoInfo(uri)?.relativePath ?? null;
    }
    async getPRsForFile(uri) {
        const info = this.gitService.getRepoInfo(uri);
        if (!info) {
            return [];
        }
        const cacheKey = `${info.owner}/${info.repo}`;
        const entry = this.cache.get(cacheKey);
        const config = vscode.workspace.getConfiguration('filePrWarning');
        const refreshMs = (config.get('refreshIntervalMinutes') ?? 10) * 60 * 1000;
        if (!entry || Date.now() - entry.fetchedAt > refreshMs) {
            await this.fetchForRepo(info.owner, info.repo);
        }
        const cached = this.cache.get(cacheKey);
        if (!cached) {
            return [];
        }
        const currentBranch = this.gitService.getCurrentBranch(uri);
        const excludeDrafts = config.get('excludeDraftPRs') ?? false;
        let prs = cached.fileIndex.get(info.relativePath) ?? [];
        prs = prs.filter(pr => {
            if (currentBranch && pr.headRefName === currentBranch) {
                return false;
            }
            if (excludeDrafts && pr.isDraft) {
                return false;
            }
            return true;
        });
        return prs;
    }
    async getLineRangesForFile(uri) {
        const info = this.gitService.getRepoInfo(uri);
        if (!info) {
            return [];
        }
        const prs = await this.getPRsForFile(uri);
        if (prs.length === 0) {
            return [];
        }
        const token = await this.authService.getToken();
        if (!token) {
            return [];
        }
        const cacheKey = `${info.owner}/${info.repo}`;
        const entry = this.cache.get(cacheKey);
        if (!entry) {
            return [];
        }
        // Initialize diff hunk cache for this file if needed
        if (!entry.diffHunkCache.has(info.relativePath)) {
            entry.diffHunkCache.set(info.relativePath, new Map());
        }
        const fileHunkCache = entry.diffHunkCache.get(info.relativePath);
        // Read the local file content for content-based line matching
        let localContent;
        try {
            const raw = await vscode.workspace.fs.readFile(uri);
            localContent = new TextDecoder().decode(raw);
        }
        catch {
            return [];
        }
        const results = [];
        for (const pr of prs) {
            let hunks = fileHunkCache.get(pr.number);
            if (!hunks) {
                try {
                    hunks = await this.githubClient.fetchFileDiff(info.owner, info.repo, pr.number, info.relativePath, token);
                    fileHunkCache.set(pr.number, hunks);
                }
                catch {
                    hunks = [];
                }
            }
            const ranges = (0, diffParser_1.mapHunksToLocalFile)(hunks, localContent);
            if (ranges.length > 0) {
                results.push({ pr, ranges });
            }
        }
        return results;
    }
    async refreshAll() {
        // Refresh all cached repos
        const promises = [];
        for (const [key] of this.cache) {
            const [owner, repo] = key.split('/');
            promises.push(this.fetchForRepo(owner, repo, true));
        }
        await Promise.all(promises);
    }
    async forceRefresh() {
        // Clear line diff cache on force refresh
        for (const [, entry] of this.cache) {
            entry.diffHunkCache.clear();
        }
        await this.refreshAll();
    }
    async fetchForRepo(owner, repo, force = false) {
        const cacheKey = `${owner}/${repo}`;
        // Concurrency guard
        if (this.fetchingPromise && !force) {
            await this.fetchingPromise;
            return;
        }
        const doFetch = async () => {
            const token = await this.authService.getToken();
            if (!token) {
                return;
            }
            try {
                const prs = await this.githubClient.fetchOpenPRs(owner, repo, token);
                // Build file index
                const fileIndex = new Map();
                for (const pr of prs) {
                    for (const filePath of pr.files) {
                        const existing = fileIndex.get(filePath) ?? [];
                        existing.push(pr);
                        fileIndex.set(filePath, existing);
                    }
                }
                // Preserve existing line diff cache if possible
                const existingEntry = this.cache.get(cacheKey);
                this.cache.set(cacheKey, {
                    prs,
                    fileIndex,
                    fetchedAt: Date.now(),
                    diffHunkCache: existingEntry?.diffHunkCache ?? new Map(),
                });
                this._onDidChangeData.fire();
            }
            catch (e) {
                if (e instanceof githubClient_1.AuthError) {
                    this.authService.clearSession();
                    // Try once more silently
                    const newToken = await this.authService.getToken();
                    if (newToken) {
                        try {
                            const prs = await this.githubClient.fetchOpenPRs(owner, repo, newToken);
                            const fileIndex = new Map();
                            for (const pr of prs) {
                                for (const filePath of pr.files) {
                                    const existing = fileIndex.get(filePath) ?? [];
                                    existing.push(pr);
                                    fileIndex.set(filePath, existing);
                                }
                            }
                            this.cache.set(cacheKey, {
                                prs,
                                fileIndex,
                                fetchedAt: Date.now(),
                                diffHunkCache: new Map(),
                            });
                            this._onDidChangeData.fire();
                            return;
                        }
                        catch {
                            // Fall through to use stale cache
                        }
                    }
                }
                else if (e instanceof githubClient_1.RateLimitError) {
                    vscode.window.showWarningMessage(`File PR Warning: ${e.message}`);
                }
                // Network errors or other failures — keep stale cache
            }
        };
        this.fetchingPromise = doFetch();
        try {
            await this.fetchingPromise;
        }
        finally {
            this.fetchingPromise = null;
        }
    }
    dispose() {
        this.stopAutoRefresh();
        this._onDidChangeData.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.PRIndex = PRIndex;
//# sourceMappingURL=prIndex.js.map