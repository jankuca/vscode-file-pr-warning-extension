import * as vscode from 'vscode';
import { RepoInfo } from '../core/types';
export declare class GitService implements vscode.Disposable {
    private gitAPI;
    private disposables;
    private readonly _onDidChangeBranch;
    readonly onDidChangeBranch: vscode.Event<void>;
    initialize(): Promise<boolean>;
    private watchRepository;
    getRepoInfo(fileUri: vscode.Uri): (RepoInfo & {
        relativePath: string;
    }) | null;
    getOriginUrl(repoRootPath: string): string | null;
    getCurrentBranch(fileUri: vscode.Uri): string | undefined;
    dispose(): void;
}
//# sourceMappingURL=gitService.d.ts.map