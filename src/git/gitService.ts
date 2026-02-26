import * as vscode from 'vscode';
import { GitExtension, Repository } from '../types/git';
import { RepoInfo } from '../core/types';

const GITHUB_REMOTE_REGEX = /github\.com[/:]([^/]+)\/([^/.]+)/;

export class GitService implements vscode.Disposable {
  private gitAPI: import('../types/git').GitAPI | undefined;
  private disposables: vscode.Disposable[] = [];

  private readonly _onDidChangeBranch = new vscode.EventEmitter<void>();
  readonly onDidChangeBranch = this._onDidChangeBranch.event;

  async initialize(): Promise<boolean> {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
      return false;
    }

    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }

    const git = gitExtension.exports;
    if (!git.enabled) {
      return false;
    }

    this.gitAPI = git.getAPI(1);

    // Watch for branch changes on all repositories
    for (const repo of this.gitAPI.repositories) {
      this.watchRepository(repo);
    }

    this.disposables.push(
      this.gitAPI.onDidOpenRepository(repo => this.watchRepository(repo))
    );

    return true;
  }

  private watchRepository(repo: Repository): void {
    let lastBranch = repo.state.HEAD?.name;
    this.disposables.push(
      repo.state.onDidChange(() => {
        const currentBranch = repo.state.HEAD?.name;
        if (currentBranch !== lastBranch) {
          lastBranch = currentBranch;
          this._onDidChangeBranch.fire();
        }
      })
    );
  }

  getRepoInfo(fileUri: vscode.Uri): (RepoInfo & { relativePath: string }) | null {
    if (!this.gitAPI) {
      return null;
    }

    const repo = this.gitAPI.getRepository(fileUri);
    if (!repo) {
      return null;
    }

    const remote = repo.state.remotes.find(r => r.name === 'origin');
    const remoteUrl = remote?.fetchUrl ?? remote?.pushUrl;
    if (!remoteUrl) {
      return null;
    }

    const match = remoteUrl.match(GITHUB_REMOTE_REGEX);
    if (!match) {
      return null;
    }

    const rootPath = repo.rootUri.fsPath;
    const filePath = fileUri.fsPath;
    const relativePath = filePath.startsWith(rootPath)
      ? filePath.slice(rootPath.length + 1)
      : filePath;

    return {
      rootUri: rootPath,
      owner: match[1],
      repo: match[2],
      relativePath,
    };
  }

  getCurrentBranch(fileUri: vscode.Uri): string | undefined {
    if (!this.gitAPI) {
      return undefined;
    }

    const repo = this.gitAPI.getRepository(fileUri);
    return repo?.state.HEAD?.name;
  }

  dispose(): void {
    this._onDidChangeBranch.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
