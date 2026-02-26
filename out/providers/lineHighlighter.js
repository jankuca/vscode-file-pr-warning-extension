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
exports.LineHighlighter = void 0;
const vscode = __importStar(require("vscode"));
class LineHighlighter {
    prIndex;
    extensionUri;
    decorationType;
    disposables = [];
    constructor(prIndex, extensionUri) {
        this.prIndex = prIndex;
        this.extensionUri = extensionUri;
        this.decorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('filePrWarning.lineHighlightBackground'),
            isWholeLine: true,
            overviewRulerColor: new vscode.ThemeColor('filePrWarning.lineHighlightBorder'),
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            gutterIconPath: vscode.Uri.joinPath(this.extensionUri, 'resources', 'gutter-warning.svg'),
            gutterIconSize: 'contain',
        });
        this.disposables.push(this.prIndex.onDidChangeData(() => this.updateActiveEditor()), vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveEditor()));
    }
    async updateActiveEditor() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const config = vscode.workspace.getConfiguration('filePrWarning');
        if (!config.get('enabled') || !config.get('showLineHighlights')) {
            editor.setDecorations(this.decorationType, []);
            return;
        }
        if (editor.document.uri.scheme !== 'file') {
            editor.setDecorations(this.decorationType, []);
            return;
        }
        const prLineData = await this.prIndex.getLineRangesForFile(editor.document.uri);
        if (prLineData.length === 0) {
            editor.setDecorations(this.decorationType, []);
            return;
        }
        // Build a map of line -> PRs for hover messages
        const lineMap = new Map();
        for (const { pr, ranges } of prLineData) {
            for (const range of ranges) {
                for (let line = range.startLine; line <= range.endLine; line++) {
                    const existing = lineMap.get(line) ?? [];
                    existing.push({
                        prTitle: pr.title,
                        prNumber: pr.number,
                        author: pr.author,
                    });
                    lineMap.set(line, existing);
                }
            }
        }
        const decorations = [];
        for (const [line, prs] of lineMap) {
            // Lines from diff are 1-based, VSCode ranges are 0-based
            const lineIndex = line - 1;
            if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
                continue;
            }
            const hover = new vscode.MarkdownString();
            hover.isTrusted = true;
            for (const pr of prs) {
                hover.appendMarkdown(`Modified by PR [#${pr.prNumber}](command:filePrWarning.showPRList) **${pr.prTitle}** by @${pr.author}\n\n`);
            }
            decorations.push({
                range: new vscode.Range(lineIndex, 0, lineIndex, 0),
                hoverMessage: hover,
            });
        }
        editor.setDecorations(this.decorationType, decorations);
    }
    clearDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            editor.setDecorations(this.decorationType, []);
        }
    }
    dispose() {
        this.decorationType.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.LineHighlighter = LineHighlighter;
//# sourceMappingURL=lineHighlighter.js.map