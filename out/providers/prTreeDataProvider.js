"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRTreeDataProvider = exports.PRTreeItem = void 0;
const vscode = __importStar(require("vscode"));
const prColors_1 = require("../core/prColors");
class PRTreeItem extends vscode.TreeItem {
    prInfo;
    constructor(prInfo, lineRanges) {
        super(`#${prInfo.number} ${prInfo.title}`, vscode.TreeItemCollapsibleState.None);
        this.prInfo = prInfo;
        this.description = `@${prInfo.author}`;
        const lines = [
            `**#${prInfo.number} ${prInfo.title}**\n\n`,
            `Author: @${prInfo.author}\n\n`,
            `Branch: \`${prInfo.headRefName}\`\n\n`,
        ];
        if (prInfo.isDraft) {
            lines.push('*(Draft)*\n\n');
        }
        if (lineRanges) {
            lines.push(`Modified lines: ${lineRanges}\n\n`);
        }
        this.tooltip = new vscode.MarkdownString(lines.join(''));
        const THEME_COLOR = {
            approved: 'terminal.ansiGreen',
            open: 'terminal.ansiCyan',
            stale: 'disabledForeground',
            draft: 'descriptionForeground',
        };
        const color = (0, prColors_1.getPRColor)(prInfo);
        this.iconPath = new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor(THEME_COLOR[color]));
        this.command = {
            command: 'vscode.open',
            title: 'Open PR',
            arguments: [vscode.Uri.parse(prInfo.url)],
        };
        this.contextValue = 'prItem';
    }
}
exports.PRTreeItem = PRTreeItem;
class PRTreeDataProvider {
    prIndex;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    disposables = [];
    constructor(prIndex) {
        this.prIndex = prIndex;
        this.disposables.push(this.prIndex.onDidChangeData(() => this._onDidChangeTreeData.fire()), vscode.window.onDidChangeActiveTextEditor(() => this._onDidChangeTreeData.fire()));
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            return [];
        }
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document.uri.scheme !== 'file') {
            return [];
        }
        const uri = editor.document.uri;
        const prs = await this.prIndex.getPRsForFile(uri);
        if (prs.length === 0) {
            return [];
        }
        const lineData = await this.prIndex.getLineRangesForFile(uri);
        const lineDataByPR = new Map();
        for (const entry of lineData) {
            const rangeStr = entry.ranges
                .map(r => r.startLine === r.endLine ? `L${r.startLine}` : `L${r.startLine}-${r.endLine}`)
                .join(', ');
            lineDataByPR.set(entry.pr.number, rangeStr);
        }
        return prs.map(pr => new PRTreeItem(pr, lineDataByPR.get(pr.number)));
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.PRTreeDataProvider = PRTreeDataProvider;
//# sourceMappingURL=prTreeDataProvider.js.map