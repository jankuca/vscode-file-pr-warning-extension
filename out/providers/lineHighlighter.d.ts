import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
export declare class LineHighlighter implements vscode.Disposable {
    private prIndex;
    private decorationTypes;
    private disposables;
    constructor(prIndex: PRIndex, _extensionUri: vscode.Uri);
    updateActiveEditor(): Promise<void>;
    clearDecorations(): void;
    dispose(): void;
}
//# sourceMappingURL=lineHighlighter.d.ts.map