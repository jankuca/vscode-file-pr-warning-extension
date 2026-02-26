import * as vscode from 'vscode';
export declare class AuthService implements vscode.Disposable {
    private session;
    private firstCall;
    private tokenRequest;
    private disposables;
    constructor();
    getToken(): Promise<string | null>;
    private doGetToken;
    clearSession(): void;
    dispose(): void;
}
//# sourceMappingURL=authService.d.ts.map