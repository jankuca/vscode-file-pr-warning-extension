import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
export declare class PRCodeLensProvider implements vscode.CodeLensProvider {
    private prIndex;
    private readonly _onDidChangeCodeLenses;
    readonly onDidChangeCodeLenses: vscode.Event<void>;
    private disposables;
    constructor(prIndex: PRIndex);
    /** Signal VS Code to re-evaluate code lenses. */
    refresh(): void;
    provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): Promise<vscode.CodeLens[]>;
    dispose(): void;
}
//# sourceMappingURL=codeLensProvider.d.ts.map