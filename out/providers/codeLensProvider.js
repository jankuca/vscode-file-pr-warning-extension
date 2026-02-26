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
exports.PRCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class PRCodeLensProvider {
    prIndex;
    _onDidChangeCodeLenses = new vscode.EventEmitter();
    onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
    disposables = [];
    constructor(prIndex) {
        this.prIndex = prIndex;
        this.disposables.push(this.prIndex.onDidChangeData(() => {
            this._onDidChangeCodeLenses.fire();
        }));
    }
    /** Signal VS Code to re-evaluate code lenses. */
    refresh() {
        this._onDidChangeCodeLenses.fire();
    }
    async provideCodeLenses(document, _token) {
        const config = vscode.workspace.getConfiguration('filePrWarning');
        if (!config.get('enabled') || !config.get('showCodeLens')) {
            return [];
        }
        let prs;
        try {
            prs = await this.prIndex.getPRsForFile(document.uri);
        }
        catch (e) {
            console.error('filePrWarning: CodeLens getPRsForFile failed', e);
            return [];
        }
        if (prs.length === 0) {
            return [];
        }
        const range = new vscode.Range(0, 0, 0, 0);
        const count = prs.length;
        const label = count === 1
            ? '$(warning) 1 open PR modifies this file'
            : `$(warning) ${count} open PRs modify this file`;
        return [
            new vscode.CodeLens(range, {
                title: label,
                command: 'filePrWarning.showPRList',
                arguments: [document.uri],
            }),
        ];
    }
    dispose() {
        this._onDidChangeCodeLenses.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.PRCodeLensProvider = PRCodeLensProvider;
//# sourceMappingURL=codeLensProvider.js.map