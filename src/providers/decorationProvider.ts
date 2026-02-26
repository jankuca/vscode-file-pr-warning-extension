import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';

export class PRFileDecorationProvider implements vscode.FileDecorationProvider, vscode.Disposable {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private prIndex: PRIndex) {
    this.disposables.push(
      this.prIndex.onDidChangeData(() => {
        this._onDidChangeFileDecorations.fire(undefined);
      })
    );
  }

  async provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): Promise<vscode.FileDecoration | undefined> {
    if (uri.scheme !== 'file') {
      return undefined;
    }

    const config = vscode.workspace.getConfiguration('filePrWarning');
    if (!config.get<boolean>('enabled') || !config.get<boolean>('showFileBadge')) {
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

  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
