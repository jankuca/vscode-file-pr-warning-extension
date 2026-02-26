"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitDiffService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const REMOTE_NAME = 'file-pr-warning';
class GitDiffService {
    /** Tracks which repo roots have had the remote set up this session. */
    remoteReady = new Map();
    /** Branches already fetched this session (repoRoot\0branchName). */
    fetchedBranches = new Set();
    /** In-flight fetch promises for deduplication. */
    fetchPromises = new Map();
    lastRemoteFetchAt = null;
    lastRemoteFetchError = false;
    async ensureRemote(repoRoot, originUrl) {
        if (this.remoteReady.get(repoRoot)) {
            return;
        }
        try {
            const { stdout } = await this.git(repoRoot, ['remote', 'get-url', REMOTE_NAME]);
            if (stdout.trim() !== originUrl) {
                await this.git(repoRoot, ['remote', 'set-url', REMOTE_NAME, originUrl]);
            }
        }
        catch {
            await this.git(repoRoot, ['remote', 'add', '--no-tags', REMOTE_NAME, originUrl]);
        }
        this.remoteReady.set(repoRoot, true);
    }
    async fetchBranch(repoRoot, originUrl, branchName) {
        await this.ensureRemote(repoRoot, originUrl);
        const key = `${repoRoot}\0${branchName}`;
        // Already fetched this session
        if (this.fetchedBranches.has(key)) {
            return true;
        }
        // Deduplicate concurrent fetches for the same branch
        const existing = this.fetchPromises.get(key);
        if (existing) {
            return existing;
        }
        const promise = this.doFetchBranch(repoRoot, branchName, key);
        this.fetchPromises.set(key, promise);
        try {
            return await promise;
        }
        finally {
            this.fetchPromises.delete(key);
        }
    }
    async doFetchBranch(repoRoot, branchName, cacheKey) {
        try {
            await this.git(repoRoot, ['fetch', '--no-tags', REMOTE_NAME, branchName]);
            this.fetchedBranches.add(cacheKey);
            this.lastRemoteFetchAt = Date.now();
            this.lastRemoteFetchError = false;
            return true;
        }
        catch {
            this.lastRemoteFetchError = true;
            return false;
        }
    }
    async diffFileAgainstBranch(repoRoot, originUrl, branchName, relativePath) {
        const fetched = await this.fetchBranch(repoRoot, originUrl, branchName);
        if (!fetched) {
            return null;
        }
        try {
            const { stdout } = await this.git(repoRoot, [
                'diff',
                `HEAD...${REMOTE_NAME}/${branchName}`,
                '--',
                relativePath,
            ]);
            return stdout;
        }
        catch {
            return null;
        }
    }
    clearFetchedBranches() {
        this.fetchedBranches.clear();
    }
    async git(cwd, args) {
        return execFileAsync('git', args, {
            cwd,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 30_000,
        });
    }
    dispose() {
        this.remoteReady.clear();
        this.fetchedBranches.clear();
        this.fetchPromises.clear();
    }
}
exports.GitDiffService = GitDiffService;
//# sourceMappingURL=gitDiffService.js.map