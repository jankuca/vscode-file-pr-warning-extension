import { execFile } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

const REMOTE_NAME = 'file-pr-warning';

export class GitDiffService implements vscode.Disposable {
  /** Tracks which repo roots have had the remote set up this session. */
  private remoteReady = new Map<string, boolean>();

  /** Branches already fetched this session (repoRoot\0branchName). */
  private fetchedBranches = new Set<string>();

  /** In-flight fetch promises for deduplication. */
  private fetchPromises = new Map<string, Promise<boolean>>();

  lastRemoteFetchAt: number | null = null;
  lastRemoteFetchError = false;

  private async ensureRemote(repoRoot: string, originUrl: string): Promise<void> {
    if (this.remoteReady.get(repoRoot)) {
      return;
    }

    try {
      const { stdout } = await this.git(repoRoot, ['remote', 'get-url', REMOTE_NAME]);
      if (stdout.trim() !== originUrl) {
        await this.git(repoRoot, ['remote', 'set-url', REMOTE_NAME, originUrl]);
      }
    } catch {
      await this.git(repoRoot, ['remote', 'add', '--no-tags', REMOTE_NAME, originUrl]);
    }

    this.remoteReady.set(repoRoot, true);
  }

  async fetchBranch(repoRoot: string, originUrl: string, branchName: string): Promise<boolean> {
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
    } finally {
      this.fetchPromises.delete(key);
    }
  }

  private async doFetchBranch(repoRoot: string, branchName: string, cacheKey: string): Promise<boolean> {
    try {
      await this.git(repoRoot, ['fetch', '--no-tags', REMOTE_NAME, branchName]);
      this.fetchedBranches.add(cacheKey);
      this.lastRemoteFetchAt = Date.now();
      this.lastRemoteFetchError = false;
      return true;
    } catch {
      this.lastRemoteFetchError = true;
      return false;
    }
  }

  async diffFileAgainstBranch(
    repoRoot: string,
    originUrl: string,
    branchName: string,
    relativePath: string,
  ): Promise<string | null> {
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
    } catch {
      return null;
    }
  }

  clearFetchedBranches(): void {
    this.fetchedBranches.clear();
  }

  private async git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return execFileAsync('git', args, {
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30_000,
    });
  }

  dispose(): void {
    this.remoteReady.clear();
    this.fetchedBranches.clear();
    this.fetchPromises.clear();
  }
}
