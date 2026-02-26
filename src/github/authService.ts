import * as vscode from 'vscode';

export class AuthService implements vscode.Disposable {
  private session: vscode.AuthenticationSession | null = null;
  private firstCall = true;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.disposables.push(
      vscode.authentication.onDidChangeSessions(e => {
        if (e.provider.id === 'github') {
          // Session may have been revoked — clear cache
          this.session = null;
        }
      })
    );
  }

  async getToken(): Promise<string | null> {
    // If we have a cached session, verify it's still valid
    if (this.session) {
      return this.session.accessToken;
    }

    try {
      const session = await vscode.authentication.getSession(
        'github',
        ['repo'],
        { createIfNone: this.firstCall, silent: !this.firstCall }
      );
      this.firstCall = false;

      if (!session) {
        return null;
      }

      this.session = session;
      return session.accessToken;
    } catch {
      this.firstCall = false;
      return null;
    }
  }

  clearSession(): void {
    this.session = null;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
