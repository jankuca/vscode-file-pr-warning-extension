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
    gitDiffService;
    cache = new Map();
    fetchingPromise = null;
    refreshTimer;
    disposables = [];
    _onDidChangeData = new vscode.EventEmitter();
    onDidChangeData = this._onDidChangeData.event;
    lastFetchedAt = null;
    lastFetchError = false;
    constructor(gitService, authService, githubClient, gitDiffService) {
        this.gitService = gitService;
        this.authService = authService;
        this.githubClient = githubClient;
        this.gitDiffService = gitDiffService;
        // Re-filter and clear diff cache on branch change (HEAD changed)
        this.disposables.push(this.gitService.onDidChangeBranch(() => {
            for (const entry of this.cache.values()) {
                entry.diffHunkCache.clear();
            }
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
        const originUrl = this.gitService.getOriginUrl(info.rootUri);
        const results = [];
        for (const pr of prs) {
            let hunks = fileHunkCache.get(pr.number);
            if (!hunks) {
                hunks = await this.computeHunks(info, pr, originUrl);
                fileHunkCache.set(pr.number, hunks);
            }
            const ranges = (0, diffParser_1.mapHunksToLocalFile)(hunks, localContent);
            if (ranges.length > 0) {
                results.push({ pr, ranges });
            }
        }
        return results;
    }
    async computeHunks(info, pr, originUrl) {
        // Try local git diff first
        if (originUrl) {
            const rawDiff = await this.gitDiffService.diffFileAgainstBranch(info.rootUri, originUrl, pr.headRefName, info.relativePath);
            if (rawDiff !== null) {
                const patch = (0, diffParser_1.extractPatchFromDiff)(rawDiff);
                if (patch) {
                    return (0, diffParser_1.parsePatchToHunks)(patch);
                }
                return []; // diff ran but no changes for this file
            }
        }
        // Fallback: GitHub API
        const token = await this.authService.getToken();
        if (!token) {
            return [];
        }
        try {
            return await this.githubClient.fetchFileDiff(info.owner, info.repo, pr.number, info.relativePath, token);
        }
        catch {
            return [];
        }
    }
    async refreshAll() {
        const promises = [];
        for (const [key] of this.cache) {
            const [owner, repo] = key.split('/');
            promises.push(this.fetchForRepo(owner, repo, true));
        }
        await Promise.all(promises);
    }
    async forceRefresh() {
        for (const [, entry] of this.cache) {
            entry.diffHunkCache.clear();
        }
        this.gitDiffService.clearFetchedBranches();
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
                // Preserve existing diff hunk cache if possible
                const existingEntry = this.cache.get(cacheKey);
                this.cache.set(cacheKey, {
                    prs,
                    fileIndex,
                    fetchedAt: Date.now(),
                    diffHunkCache: existingEntry?.diffHunkCache ?? new Map(),
                });
                this.lastFetchedAt = Date.now();
                this.lastFetchError = false;
                this._onDidChangeData.fire();
                // Eagerly fetch all PR branches in the background
                this.eagerFetchBranches(prs);
            }
            catch (e) {
                if (e instanceof githubClient_1.AuthError) {
                    this.authService.clearSession();
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
                            this.lastFetchedAt = Date.now();
                            this.lastFetchError = false;
                            this._onDidChangeData.fire();
                            this.eagerFetchBranches(prs);
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
                this.lastFetchError = true;
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
    /** Fire-and-forget: fetch all PR branches so they're ready when files are opened. */
    eagerFetchBranches(prs) {
        // Collect unique branch names and find a repo root to use
        const branches = new Set();
        for (const pr of prs) {
            branches.add(pr.headRefName);
        }
        // Find a repo root from any cached entry (we need it for git operations)
        let repoRoot = null;
        let originUrl = null;
        for (const entry of this.cache.values()) {
            for (const pr of entry.prs) {
                if (branches.has(pr.headRefName)) {
                    // Use the first PR's repo root we can find
                    for (const repo of this.cache.keys()) {
                        const [owner, repoName] = repo.split('/');
                        // Find a workspace folder that matches this repo
                        for (const folder of vscode.workspace.workspaceFolders ?? []) {
                            const info = this.gitService.getRepoInfo(folder.uri);
                            if (info && info.owner === owner && info.repo === repoName) {
                                repoRoot = info.rootUri;
                                originUrl = this.gitService.getOriginUrl(info.rootUri);
                                break;
                            }
                        }
                        if (repoRoot) {
                            break;
                        }
                    }
                    break;
                }
            }
            if (repoRoot) {
                break;
            }
        }
        if (!repoRoot || !originUrl) {
            return;
        }
        const root = repoRoot;
        const url = originUrl;
        for (const branch of branches) {
            // Fire and forget — errors are handled inside fetchBranch
            this.gitDiffService.fetchBranch(root, url, branch).catch(() => { });
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