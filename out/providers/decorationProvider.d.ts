import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
export declare class PRFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
    private prIndex;
    private readonly _onDidChangeFileDecorations;
    readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined>;
    private disposables;
    constructor(prIndex: PRIndex);
    provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): Promise<vscode.FileDecoration | undefined>;
    dispose(): void;
}
//# sourceMappingURL=decorationProvider.d.ts.map