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
const prColors_1 = require("../core/prColors");
const WIDTH_PX = { 1: 2, 2: 3, 3: 4, 4: 5 };
function gutterSvgUri(color, width) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect fill="${color}" x="2" y="2" width="${width}" height="12" rx="1"/></svg>`;
    return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}
function makeKey(color, width) {
    return `${color}-${width}`;
}
class LineHighlighter {
    prIndex;
    decorationTypes = new Map();
    disposables = [];
    constructor(prIndex, _extensionUri) {
        this.prIndex = prIndex;
        // Pre-create a decoration type for each color × width combination (4×4 = 16)
        const colors = ['approved', 'open', 'stale', 'draft'];
        const widths = [1, 2, 3, 4];
        for (const color of colors) {
            for (const w of widths) {
                const key = makeKey(color, w);
                const dt = vscode.window.createTextEditorDecorationType({
                    overviewRulerColor: prColors_1.COLOR_HEX[color] + '60',
                    overviewRulerLane: vscode.OverviewRulerLane.Left,
                    gutterIconPath: gutterSvgUri(prColors_1.COLOR_HEX[color], WIDTH_PX[w]),
                    gutterIconSize: 'contain',
                });
                this.decorationTypes.set(key, dt);
            }
        }
        this.disposables.push(this.prIndex.onDidChangeData(() => this.updateActiveEditor()), vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveEditor()));
    }
    async updateActiveEditor() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        const config = vscode.workspace.getConfiguration('filePrWarning');
        if (!config.get('enabled') || !config.get('showLineHighlights')) {
            this.clearDecorations();
            return;
        }
        if (editor.document.uri.scheme !== 'file') {
            this.clearDecorations();
            return;
        }
        const prLineData = await this.prIndex.getLineRangesForFile(editor.document.uri);
        if (prLineData.length === 0) {
            this.clearDecorations();
            return;
        }
        // Build per-line data: which PRs touch each line
        const lineMap = new Map();
        for (const { pr, ranges } of prLineData) {
            for (const range of ranges) {
                for (let line = range.startLine; line <= range.endLine; line++) {
                    const existing = lineMap.get(line) ?? [];
                    existing.push(pr);
                    lineMap.set(line, existing);
                }
            }
        }
        // Group decorations by variant key
        const grouped = new Map();
        for (const [line, prs] of lineMap) {
            const lineIndex = line - 1;
            if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
                continue;
            }
            const color = (0, prColors_1.getMostUrgentColor)(prs);
            const widthLevel = Math.min(prs.length, 4);
            const key = makeKey(color, widthLevel);
            const hover = new vscode.MarkdownString();
            hover.isTrusted = true;
            for (const pr of prs) {
                hover.appendMarkdown(`Modified by PR [#${pr.number} ${pr.title}](${pr.url}) by @${pr.author}\n\n`);
            }
            const deco = {
                range: new vscode.Range(lineIndex, 0, lineIndex, 0),
                hoverMessage: hover,
            };
            const list = grouped.get(key);
            if (list) {
                list.push(deco);
            }
            else {
                grouped.set(key, [deco]);
            }
        }
        // Apply each variant; clear variants that have no lines this time
        for (const [key, dt] of this.decorationTypes) {
            editor.setDecorations(dt, grouped.get(key) ?? []);
        }
    }
    clearDecorations() {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            for (const dt of this.decorationTypes.values()) {
                editor.setDecorations(dt, []);
            }
        }
    }
    dispose() {
        for (const dt of this.decorationTypes.values()) {
            dt.dispose();
        }
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.LineHighlighter = LineHighlighter;
//# sourceMappingURL=lineHighlighter.js.map