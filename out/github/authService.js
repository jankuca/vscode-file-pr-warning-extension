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
exports.AuthService = void 0;
const vscode = __importStar(require("vscode"));
class AuthService {
    session = null;
    firstCall = true;
    tokenRequest = null;
    disposables = [];
    constructor() {
        this.disposables.push(vscode.authentication.onDidChangeSessions(e => {
            if (e.provider.id === 'github') {
                // Session may have been revoked — clear cache
                this.session = null;
            }
        }));
    }
    async getToken() {
        // If we have a cached session, verify it's still valid
        if (this.session) {
            return this.session.accessToken;
        }
        // Coalesce concurrent calls into a single auth request
        if (this.tokenRequest) {
            return this.tokenRequest;
        }
        this.tokenRequest = this.doGetToken();
        try {
            return await this.tokenRequest;
        }
        finally {
            this.tokenRequest = null;
        }
    }
    async doGetToken() {
        try {
            const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone: this.firstCall, silent: !this.firstCall });
            this.firstCall = false;
            if (!session) {
                return null;
            }
            this.session = session;
            return session.accessToken;
        }
        catch (err) {
            console.error('filePrWarning: failed to acquire GitHub token', err);
            this.firstCall = false;
            return null;
        }
    }
    clearSession() {
        this.session = null;
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=authService.js.map