import * as vscode from 'vscode';
import { PRInfo, PRLineData } from './types';
import { GitService } from '../git/gitService';
import { AuthService } from '../github/authService';
import { GitHubClient } from '../github/githubClient';
export declare class PRIndex implements vscode.Disposable {
    private gitService;
    private authService;
    private githubClient;
    private cache;
    private fetchingPromise;
    private refreshTimer;
    private disposables;
    private readonly _onDidChangeData;
    readonly onDidChangeData: vscode.Event<void>;
    constructor(gitService: GitService, authService: AuthService, githubClient: GitHubClient);
    startAutoRefresh(intervalMinutes: number): void;
    stopAutoRefresh(): void;
    getRelativePath(uri: vscode.Uri): string | null;
    getPRsForFile(uri: vscode.Uri): Promise<PRInfo[]>;
    getLineRangesForFile(uri: vscode.Uri): Promise<PRLineData[]>;
    refreshAll(): Promise<void>;
    forceRefresh(): Promise<void>;
    private fetchForRepo;
    dispose(): void;
}
//# sourceMappingURL=prIndex.d.ts.map