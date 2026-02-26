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
exports.PRFileDecorationProvider = void 0;
const vscode = __importStar(require("vscode"));
class PRFileDecorationProvider {
    prIndex;
    _onDidChangeFileDecorations = new vscode.EventEmitter();
    onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    disposables = [];
    constructor(prIndex) {
        this.prIndex = prIndex;
        this.disposables.push(this.prIndex.onDidChangeData(() => {
            this._onDidChangeFileDecorations.fire(undefined);
        }));
    }
    async provideFileDecoration(uri, _token) {
        if (uri.scheme !== 'file') {
            return undefined;
        }
        const config = vscode.workspace.getConfiguration('filePrWarning');
        if (!config.get('enabled') || !config.get('showFileBadge')) {
            return undefined;
        }
        const prs = await this.prIndex.getPRsForFile(uri);
        if (prs.length === 0) {
            return undefined;
        }
        const count = prs.length;
        const badge = count > 99 ? '99' : String(count);
        const tooltip = count === 1
            ? '1 open PR modifies this file'
            : `${count} open PRs modify this file`;
        return {
            badge,
            tooltip,
            color: new vscode.ThemeColor('filePrWarning.lineHighlightBorder'),
            propagate: false,
        };
    }
    dispose() {
        this._onDidChangeFileDecorations.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.PRFileDecorationProvider = PRFileDecorationProvider;
//# sourceMappingURL=decorationProvider.js.map