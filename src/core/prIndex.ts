import * as vscode from 'vscode';
import { PRInfo, PRLineData, RepoCacheEntry, LineRange } from './types';
import { GitService } from '../git/gitService';
import { AuthService } from '../github/authService';
import { GitHubClient, AuthError, RateLimitError } from '../github/githubClient';

export class PRIndex implements vscode.Disposable {
  private cache = new Map<string, RepoCacheEntry>();
  private fetchingPromise: Promise<void> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeData = new vscode.EventEmitter<void>();
  readonly onDidChangeData = this._onDidChangeData.event;

  constructor(
    private gitService: GitService,
    private authService: AuthService,
    private githubClient: GitHubClient
  ) {
    // Re-filter on branch change (no re-fetch needed)
    this.disposables.push(
      this.gitService.onDidChangeBranch(() => {
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

    const token = await this.authService.getToken();
    if (!token) {
      return [];
    }

    const cacheKey = `${info.owner}/${info.repo}`;
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return [];
    }

    // Initialize line diff cache for this file if needed
    if (!entry.lineDiffCache.has(info.relativePath)) {
      entry.lineDiffCache.set(info.relativePath, new Map());
    }
    const fileDiffCache = entry.lineDiffCache.get(info.relativePath)!;

    const results: PRLineData[] = [];

    for (const pr of prs) {
      let ranges = fileDiffCache.get(pr.number);
      if (!ranges) {
        try {
          ranges = await this.githubClient.fetchFileDiff(
            info.owner,
            info.repo,
            pr.number,
            info.relativePath,
            token
          );
          fileDiffCache.set(pr.number, ranges);
        } catch {
          ranges = [];
        }
      }

      if (ranges.length > 0) {
        results.push({ pr, ranges });
      }
    }

    return results;
  }

  async refreshAll(): Promise<void> {
    // Refresh all cached repos
    const promises: Promise<void>[] = [];
    for (const [key] of this.cache) {
      const [owner, repo] = key.split('/');
      promises.push(this.fetchForRepo(owner, repo, true));
    }
    await Promise.all(promises);
  }

  async forceRefresh(): Promise<void> {
    // Clear line diff cache on force refresh
    for (const [, entry] of this.cache) {
      entry.lineDiffCache.clear();
    }
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

        // Preserve existing line diff cache if possible
        const existingEntry = this.cache.get(cacheKey);
        this.cache.set(cacheKey, {
          prs,
          fileIndex,
          fetchedAt: Date.now(),
          lineDiffCache: existingEntry?.lineDiffCache ?? new Map(),
        });

        this._onDidChangeData.fire();
      } catch (e) {
        if (e instanceof AuthError) {
          this.authService.clearSession();
          // Try once more silently
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
                lineDiffCache: new Map(),
              });
              this._onDidChangeData.fire();
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

  dispose(): void {
    this.stopAutoRefresh();
    this._onDidChangeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
