import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
export declare class LineHighlighter implements vscode.Disposable {
    private prIndex;
    private extensionUri;
    private decorationType;
    private disposables;
    constructor(prIndex: PRIndex, extensionUri: vscode.Uri);
    updateActiveEditor(): Promise<void>;
    clearDecorations(): void;
    dispose(): void;
}
//# sourceMappingURL=lineHighlighter.d.ts.map