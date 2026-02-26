import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';

export class PRCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private prIndex: PRIndex) {
    this.disposables.push(
      this.prIndex.onDidChangeData(() => {
        this._onDidChangeCodeLenses.fire();
      })
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    const config = vscode.workspace.getConfiguration('filePrWarning');
    if (!config.get<boolean>('enabled') || !config.get<boolean>('showCodeLens')) {
      return [];
    }

    let prs;
    try {
      prs = await this.prIndex.getPRsForFile(document.uri);
    } catch (e) {
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

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
