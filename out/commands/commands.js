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
exports.registerCommands = registerCommands;
const crypto = __importStar(require("crypto"));
const vscode = __importStar(require("vscode"));
function registerCommands(context, prIndex) {
    context.subscriptions.push(vscode.commands.registerCommand('filePrWarning.showPRList', showPRList(prIndex)), vscode.commands.registerCommand('filePrWarning.showLinePRs', showLinePRs(prIndex)), vscode.commands.registerCommand('filePrWarning.refresh', refresh(prIndex)));
}
function showPRList(prIndex) {
    return async (uri) => {
        const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!fileUri) {
            return;
        }
        const prs = await prIndex.getPRsForFile(fileUri);
        if (prs.length === 0) {
            vscode.window.showInformationMessage('No open PRs modify this file.');
            return;
        }
        const items = prs.map(pr => ({
            label: `#${pr.number} ${pr.title}`,
            description: `by @${pr.author}`,
            detail: `Created ${timeAgo(pr.createdAt)} | Updated ${timeAgo(pr.updatedAt)}`,
            pr,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a PR to open in browser',
        });
        if (selected) {
            vscode.env.openExternal(vscode.Uri.parse(selected.pr.url));
        }
    };
}
function showLinePRs(prIndex) {
    return async (arg) => {
        const editor = vscode.window.activeTextEditor;
        // Context menu passes 1-based lineNumber; fallback to cursor position
        const lineNumber = arg?.lineNumber ?? (editor ? editor.selection.active.line + 1 : undefined);
        const fileUri = arg?.uri ?? editor?.document.uri;
        if (!fileUri || !lineNumber) {
            return;
        }
        const prLineData = await prIndex.getLineRangesForFile(fileUri);
        const matchingPRs = prLineData
            .filter(({ ranges }) => ranges.some(r => lineNumber >= r.startLine && lineNumber <= r.endLine))
            .map(({ pr }) => pr);
        if (matchingPRs.length === 0) {
            vscode.window.showInformationMessage('No open PRs modify this line.');
            return;
        }
        const relativePath = prIndex.getRelativePath(fileUri);
        const fileAnchor = relativePath
            ? `#diff-${crypto.createHash('sha256').update(relativePath).digest('hex')}`
            : '';
        const items = matchingPRs.map(pr => ({
            label: `#${pr.number} ${pr.title}`,
            description: `by @${pr.author}`,
            detail: `Created ${timeAgo(pr.createdAt)} | Updated ${timeAgo(pr.updatedAt)}`,
            pr,
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a PR to open in diff',
        });
        if (selected) {
            vscode.env.openExternal(vscode.Uri.parse(`${selected.pr.url}/files${fileAnchor}`));
        }
    };
}
function refresh(prIndex) {
    return async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'File PR Warning: Refreshing PR data...',
            cancellable: false,
        }, async () => {
            await prIndex.forceRefresh();
        });
    };
}
function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffWeek = Math.floor(diffDay / 7);
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth > 0) {
        return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
    }
    if (diffWeek > 0) {
        return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
    }
    if (diffDay > 0) {
        return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
    }
    if (diffHour > 0) {
        return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
    }
    if (diffMin > 0) {
        return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
    }
    return 'just now';
}
//# sourceMappingURL=commands.js.map