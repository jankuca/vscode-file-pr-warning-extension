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
exports.GitService = void 0;
const vscode = __importStar(require("vscode"));
const GITHUB_REMOTE_REGEX = /github\.com[/:]([^/]+)\/([^/.]+)/;
class GitService {
    gitAPI;
    disposables = [];
    _onDidChangeBranch = new vscode.EventEmitter();
    onDidChangeBranch = this._onDidChangeBranch.event;
    async initialize() {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        if (!gitExtension) {
            return false;
        }
        if (!gitExtension.isActive) {
            await gitExtension.activate();
        }
        const git = gitExtension.exports;
        if (!git.enabled) {
            return false;
        }
        this.gitAPI = git.getAPI(1);
        // Watch for branch changes on all repositories
        for (const repo of this.gitAPI.repositories) {
            this.watchRepository(repo);
        }
        this.disposables.push(this.gitAPI.onDidOpenRepository(repo => this.watchRepository(repo)));
        return true;
    }
    watchRepository(repo) {
        let lastBranch = repo.state.HEAD?.name;
        this.disposables.push(repo.state.onDidChange(() => {
            const currentBranch = repo.state.HEAD?.name;
            if (currentBranch !== lastBranch) {
                lastBranch = currentBranch;
                this._onDidChangeBranch.fire();
            }
        }));
    }
    getRepoInfo(fileUri) {
        if (!this.gitAPI) {
            return null;
        }
        const repo = this.gitAPI.getRepository(fileUri);
        if (!repo) {
            return null;
        }
        const remote = repo.state.remotes.find(r => r.name === 'origin');
        const remoteUrl = remote?.fetchUrl ?? remote?.pushUrl;
        if (!remoteUrl) {
            return null;
        }
        const match = remoteUrl.match(GITHUB_REMOTE_REGEX);
        if (!match) {
            return null;
        }
        const rootPath = repo.rootUri.fsPath;
        const filePath = fileUri.fsPath;
        const relativePath = filePath.startsWith(rootPath)
            ? filePath.slice(rootPath.length + 1)
            : filePath;
        return {
            rootUri: rootPath,
            owner: match[1],
            repo: match[2],
            relativePath,
        };
    }
    getOriginUrl(repoRootPath) {
        if (!this.gitAPI) {
            return null;
        }
        for (const repo of this.gitAPI.repositories) {
            if (repo.rootUri.fsPath === repoRootPath) {
                const remote = repo.state.remotes.find(r => r.name === 'origin');
                return remote?.fetchUrl ?? remote?.pushUrl ?? null;
            }
        }
        return null;
    }
    getCurrentBranch(fileUri) {
        if (!this.gitAPI) {
            return undefined;
        }
        const repo = this.gitAPI.getRepository(fileUri);
        return repo?.state.HEAD?.name;
    }
    dispose() {
        this._onDidChangeBranch.dispose();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.GitService = GitService;
//# sourceMappingURL=gitService.js.map