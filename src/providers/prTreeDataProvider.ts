import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
import { PRInfo } from '../core/types';
import { getPRColor } from '../core/prColors';

export class PRTreeItem extends vscode.TreeItem {
  constructor(public readonly prInfo: PRInfo, lineRanges?: string) {
    super(`#${prInfo.number} ${prInfo.title}`, vscode.TreeItemCollapsibleState.None);

    this.description = `@${prInfo.author}`;

    const lines: string[] = [
      `**#${prInfo.number} ${prInfo.title}**\n\n`,
      `Author: @${prInfo.author}\n\n`,
      `Branch: \`${prInfo.headRefName}\`\n\n`,
    ];
    if (prInfo.isDraft) {
      lines.push('*(Draft)*\n\n');
    }
    if (lineRanges) {
      lines.push(`Modified lines: ${lineRanges}\n\n`);
    }
    this.tooltip = new vscode.MarkdownString(lines.join(''));

    const THEME_COLOR: Record<string, string> = {
      approved: 'terminal.ansiGreen',
      open: 'terminal.ansiCyan',
      stale: 'disabledForeground',
      draft: 'descriptionForeground',
    };
    const color = getPRColor(prInfo);
    this.iconPath = new vscode.ThemeIcon(
      'git-pull-request',
      new vscode.ThemeColor(THEME_COLOR[color]),
    );

    this.command = {
      command: 'vscode.open',
      title: 'Open PR',
      arguments: [vscode.Uri.parse(prInfo.url)],
    };

    this.contextValue = 'prItem';
  }
}

export class PRTreeDataProvider implements vscode.TreeDataProvider<PRTreeItem>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(private prIndex: PRIndex) {
    this.disposables.push(
      this.prIndex.onDidChangeData(() => this._onDidChangeTreeData.fire()),
      vscode.window.onDidChangeActiveTextEditor(() => this._onDidChangeTreeData.fire()),
    );
  }

  getTreeItem(element: PRTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: PRTreeItem): Promise<PRTreeItem[]> {
    if (element) {
      return [];
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
      return [];
    }

    const uri = editor.document.uri;
    const prs = await this.prIndex.getPRsForFile(uri);
    if (prs.length === 0) {
      return [];
    }

    const lineData = await this.prIndex.getLineRangesForFile(uri);
    const lineDataByPR = new Map<number, string>();
    for (const entry of lineData) {
      const rangeStr = entry.ranges
        .map(r => r.startLine === r.endLine ? `L${r.startLine}` : `L${r.startLine}-${r.endLine}`)
        .join(', ');
      lineDataByPR.set(entry.pr.number, rangeStr);
    }

    return prs.map(pr => new PRTreeItem(pr, lineDataByPR.get(pr.number)));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
