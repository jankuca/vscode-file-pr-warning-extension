import * as vscode from 'vscode';
export declare class GitDiffService implements vscode.Disposable {
    /** Tracks which repo roots have had the remote set up this session. */
    private remoteReady;
    /** Branches already fetched this session (repoRoot\0branchName). */
    private fetchedBranches;
    /** In-flight fetch promises for deduplication. */
    private fetchPromises;
    lastRemoteFetchAt: number | null;
    lastRemoteFetchError: boolean;
    private ensureRemote;
    fetchBranch(repoRoot: string, originUrl: string, branchName: string): Promise<boolean>;
    private doFetchBranch;
    diffFileAgainstBranch(repoRoot: string, originUrl: string, branchName: string, relativePath: string): Promise<string | null>;
    clearFetchedBranches(): void;
    private git;
    dispose(): void;
}
//# sourceMappingURL=gitDiffService.d.ts.map