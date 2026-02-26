import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
import { PRInfo } from '../core/types';
export declare class PRTreeItem extends vscode.TreeItem {
    readonly prInfo: PRInfo;
    constructor(prInfo: PRInfo, lineRanges?: string);
}
export declare class PRTreeDataProvider implements vscode.TreeDataProvider<PRTreeItem>, vscode.Disposable {
    private prIndex;
    private readonly _onDidChangeTreeData;
    readonly onDidChangeTreeData: vscode.Event<void>;
    private disposables;
    constructor(prIndex: PRIndex);
    getTreeItem(element: PRTreeItem): vscode.TreeItem;
    getChildren(element?: PRTreeItem): Promise<PRTreeItem[]>;
    dispose(): void;
}
//# sourceMappingURL=prTreeDataProvider.d.ts.map