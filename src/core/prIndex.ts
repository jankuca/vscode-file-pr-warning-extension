import * as vscode from 'vscode';
import { PRInfo, PRLineData, RepoCacheEntry } from './types';
import { extractPatchFromDiff, parsePatchToHunks, mapHunksToLocalFile } from './diffParser';
import { GitService } from '../git/gitService';
import { GitDiffService } from '../git/gitDiffService';
import { AuthService } from '../github/authService';
import { GitHubClient, AuthError, RateLimitError } from '../github/githubClient';

export class PRIndex implements vscode.Disposable {
  private cache = new Map<string, RepoCacheEntry>();
  private fetchingPromise: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeData = new vscode.EventEmitter<void>();
  readonly onDidChangeData = this._onDidChangeData.event;

  lastFetchedAt: number | null = null;
  lastFetchError = false;

  constructor(
    private gitService: GitService,
    private authService: AuthService,
    private githubClient: GitHubClient,
    private gitDiffService: GitDiffService,
  ) {
    // Re-filter and clear diff cache on branch change (HEAD changed)
    this.disposables.push(
      this.gitService.onDidChangeBranch(() => {
        for (const entry of this.cache.values()) {
          entry.diffHunkCache.clear();
        }
        this._onDidChangeData.fire();
      })
    );
  }

  startAutoRefresh(intervalMinutes: number): void {
    this.stopAutoRefresh();
    const ms = intervalMinutes * 60 * 1000;
    this.refreshTimer = setInterval(() => {
      this.refreshAll();
    }, ms);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  getRelativePath(uri: vscode.Uri): string | null {
    return this.gitService.getRepoInfo(uri)?.relativePath ?? null;
  }

  async getPRsForFile(uri: vscode.Uri): Promise<PRInfo[]> {
    const info = this.gitService.getRepoInfo(uri);
    if (!info) {
      return [];
    }

    const cacheKey = `${info.owner}/${info.repo}`;
    const entry = this.cache.get(cacheKey);
    const config = vscode.workspace.getConfiguration('filePrWarning');
    const refreshMs = (config.get<number>('refreshIntervalMinutes') ?? 10) * 60 * 1000;

    if (!entry || Date.now() - entry.fetchedAt > refreshMs) {
      await this.fetchForRepo(info.owner, info.repo);
    }

    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return [];
    }

    const currentBranch = this.gitService.getCurrentBranch(uri);
    const excludeDrafts = config.get<boolean>('excludeDraftPRs') ?? false;

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

  async getLineRangesForFile(uri: vscode.Uri): Promise<PRLineData[]> {
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
    const fileHunkCache = entry.diffHunkCache.get(info.relativePath)!;

    // Read the local file content for content-based line matching
    let localContent: string;
    try {
      const raw = await vscode.workspace.fs.readFile(uri);
      localContent = new TextDecoder().decode(raw);
    } catch {
      return [];
    }

    const originUrl = this.gitService.getOriginUrl(info.rootUri);
    const results: PRLineData[] = [];

    for (const pr of prs) {
      let hunks = fileHunkCache.get(pr.number);
      if (!hunks) {
        hunks = await this.computeHunks(info, pr, originUrl);
        fileHunkCache.set(pr.number, hunks);
      }

      const ranges = mapHunksToLocalFile(hunks, localContent);
      if (ranges.length > 0) {
        results.push({ pr, ranges });
      }
    }

    return results;
  }

  private async computeHunks(
    info: { rootUri: string; owner: string; repo: string; relativePath: string },
    pr: PRInfo,
    originUrl: string | null,
  ) {
    // Try local git diff first
    if (originUrl) {
      const rawDiff = await this.gitDiffService.diffFileAgainstBranch(
        info.rootUri, originUrl, pr.headRefName, info.relativePath
      );
      if (rawDiff !== null) {
        const patch = extractPatchFromDiff(rawDiff);
        if (patch) {
          return parsePatchToHunks(patch);
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
      return await this.githubClient.fetchFileDiff(
        info.owner, info.repo, pr.number, info.relativePath, token
      );
    } catch {
      return [];
    }
  }

  async refreshAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [key] of this.cache) {
      const [owner, repo] = key.split('/');
      promises.push(this.fetchForRepo(owner, repo, true));
    }
    await Promise.all(promises);
  }

  async forceRefresh(): Promise<void> {
    for (const [, entry] of this.cache) {
      entry.diffHunkCache.clear();
    }
    this.gitDiffService.clearFetchedBranches();
    await this.refreshAll();
  }

  private async fetchForRepo(owner: string, repo: string, force = false): Promise<void> {
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
        const fileIndex = new Map<string, PRInfo[]>();
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
      } catch (e) {
        if (e instanceof AuthError) {
          this.authService.clearSession();
          const newToken = await this.authService.getToken();
          if (newToken) {
            try {
              const prs = await this.githubClient.fetchOpenPRs(owner, repo, newToken);
              const fileIndex = new Map<string, PRInfo[]>();
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
            } catch {
              // Fall through to use stale cache
            }
          }
        } else if (e instanceof RateLimitError) {
          vscode.window.showWarningMessage(
            `File PR Warning: ${e.message}`
          );
        }
        this.lastFetchError = true;
        // Network errors or other failures — keep stale cache
      }
    };

    this.fetchingPromise = doFetch();
    try {
      await this.fetchingPromise;
    } finally {
      this.fetchingPromise = null;
    }
  }

  /** Fire-and-forget: fetch all PR branches so they're ready when files are opened. */
  private eagerFetchBranches(prs: PRInfo[]): void {
    // Collect unique branch names and find a repo root to use
    const branches = new Set<string>();
    for (const pr of prs) {
      branches.add(pr.headRefName);
    }

    // Find a repo root from any cached entry (we need it for git operations)
    let repoRoot: string | null = null;
    let originUrl: string | null = null;

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
            if (repoRoot) { break; }
          }
          break;
        }
      }
      if (repoRoot) { break; }
    }

    if (!repoRoot || !originUrl) {
      return;
    }

    const root = repoRoot;
    const url = originUrl;

    for (const branch of branches) {
      // Fire and forget — errors are handled inside fetchBranch
      this.gitDiffService.fetchBranch(root, url, branch).catch(() => {});
    }
  }

  dispose(): void {
    this.stopAutoRefresh();
    this._onDidChangeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
