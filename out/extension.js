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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const gitService_1 = require("./git/gitService");
const authService_1 = require("./github/authService");
const githubClient_1 = require("./github/githubClient");
const prIndex_1 = require("./core/prIndex");
const codeLensProvider_1 = require("./providers/codeLensProvider");
const decorationProvider_1 = require("./providers/decorationProvider");
const lineHighlighter_1 = require("./providers/lineHighlighter");
const commands_1 = require("./commands/commands");
let gitService;
let authService;
let githubClient;
let prIndex;
let codeLensProvider;
let decorationProvider;
let lineHighlighter;
async function activate(context) {
    const config = vscode.workspace.getConfiguration('filePrWarning');
    if (!config.get('enabled')) {
        return;
    }
    // Initialize git service
    gitService = new gitService_1.GitService();
    const gitReady = await gitService.initialize();
    if (!gitReady) {
        // No git — extension stays dormant
        return;
    }
    // Initialize services
    authService = new authService_1.AuthService();
    githubClient = new githubClient_1.GitHubClient();
    prIndex = new prIndex_1.PRIndex(gitService, authService, githubClient);
    // Register commands
    (0, commands_1.registerCommands)(context, prIndex);
    // Register CodeLens provider
    codeLensProvider = new codeLensProvider_1.PRCodeLensProvider(prIndex);
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider));
    // Register file decoration provider
    decorationProvider = new decorationProvider_1.PRFileDecorationProvider(prIndex);
    context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));
    // Initialize line highlighter
    lineHighlighter = new lineHighlighter_1.LineHighlighter(prIndex, context.extensionUri);
    // Start auto-refresh timer
    const refreshInterval = config.get('refreshIntervalMinutes') ?? 10;
    prIndex.startAutoRefresh(refreshInterval);
    // React to configuration changes
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e => {
        if (!e.affectsConfiguration('filePrWarning')) {
            return;
        }
        const updatedConfig = vscode.workspace.getConfiguration('filePrWarning');
        if (e.affectsConfiguration('filePrWarning.refreshIntervalMinutes')) {
            const interval = updatedConfig.get('refreshIntervalMinutes') ?? 10;
            prIndex.startAutoRefresh(interval);
        }
        if (e.affectsConfiguration('filePrWarning.showCodeLens')) {
            // CodeLens provider will re-evaluate on next request
            codeLensProvider['_onDidChangeCodeLenses'].fire();
        }
        if (e.affectsConfiguration('filePrWarning.showFileBadge')) {
            decorationProvider['_onDidChangeFileDecorations'].fire(undefined);
        }
        if (e.affectsConfiguration('filePrWarning.showLineHighlights')) {
            if (!updatedConfig.get('showLineHighlights')) {
                lineHighlighter.clearDecorations();
            }
            else {
                lineHighlighter.updateActiveEditor();
            }
        }
        if (e.affectsConfiguration('filePrWarning.excludeDraftPRs')) {
            // Data needs re-filtering
            prIndex['_onDidChangeData'].fire();
        }
        if (e.affectsConfiguration('filePrWarning.enabled')) {
            if (!updatedConfig.get('enabled')) {
                // Disable everything
                prIndex.stopAutoRefresh();
                lineHighlighter.clearDecorations();
                codeLensProvider['_onDidChangeCodeLenses'].fire();
                decorationProvider['_onDidChangeFileDecorations'].fire(undefined);
            }
            else {
                // Re-enable
                const interval = updatedConfig.get('refreshIntervalMinutes') ?? 10;
                prIndex.startAutoRefresh(interval);
                prIndex['_onDidChangeData'].fire();
            }
        }
    }));
    // Trigger initial fetch for the active editor
    if (vscode.window.activeTextEditor) {
        prIndex.getPRsForFile(vscode.window.activeTextEditor.document.uri);
    }
    // Fetch when files are opened
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor?.document.uri.scheme === 'file') {
            prIndex.getPRsForFile(editor.document.uri);
        }
    }));
    // Register disposables
    context.subscriptions.push(gitService, authService, prIndex, codeLensProvider, decorationProvider, lineHighlighter);
}
function deactivate() {
    // Cleanup is handled by disposables registered in context.subscriptions
}
//# sourceMappingURL=extension.js.map