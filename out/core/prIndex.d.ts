import * as vscode from 'vscode';
import { PRInfo, PRLineData } from './types';
import { GitService } from '../git/gitService';
import { GitDiffService } from '../git/gitDiffService';
import { AuthService } from '../github/authService';
import { GitHubClient } from '../github/githubClient';
export declare class PRIndex implements vscode.Disposable {
    private gitService;
    private authService;
    private githubClient;
    private gitDiffService;
    private cache;
    private fetchingPromise;
    private refreshTimer;
    private disposables;
    private readonly _onDidChangeData;
    readonly onDidChangeData: vscode.Event<void>;
    lastFetchedAt: number | null;
    lastFetchError: boolean;
    constructor(gitService: GitService, authService: AuthService, githubClient: GitHubClient, gitDiffService: GitDiffService);
    startAutoRefresh(intervalMinutes: number): void;
    stopAutoRefresh(): void;
    getRelativePath(uri: vscode.Uri): string | null;
    getPRsForFile(uri: vscode.Uri): Promise<PRInfo[]>;
    getLineRangesForFile(uri: vscode.Uri): Promise<PRLineData[]>;
    private computeHunks;
    refreshAll(): Promise<void>;
    forceRefresh(): Promise<void>;
    private fetchForRepo;
    /** Fire-and-forget: fetch all PR branches so they're ready when files are opened. */
    private eagerFetchBranches;
    dispose(): void;
}
//# sourceMappingURL=prIndex.d.ts.map