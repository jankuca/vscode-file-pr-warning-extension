import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
import { LineRange, PRInfo } from '../core/types';
import { getPRColor } from '../core/prColors';

export class PRTreeItem extends vscode.TreeItem {
  constructor(public readonly prInfo: PRInfo, lineRanges?: string, isSelected?: boolean) {
    const labelText = `#${prInfo.number} ${prInfo.title}`;
    super(
      isSelected
        ? { label: labelText, highlights: [[0, labelText.length]] } as vscode.TreeItemLabel
        : labelText,
      vscode.TreeItemCollapsibleState.None,
    );

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

  private selectedLines = new Set<number>();
  private selectionDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor(private prIndex: PRIndex) {
    this.disposables.push(
      this.prIndex.onDidChangeData(() => this._onDidChangeTreeData.fire()),
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.selectedLines.clear();
        this._onDidChangeTreeData.fire();
      }),
      vscode.window.onDidChangeTextEditorSelection(e => {
        if (e.textEditor !== vscode.window.activeTextEditor) {
          return;
        }
        clearTimeout(this.selectionDebounceTimer);
        this.selectionDebounceTimer = setTimeout(() => {
          this.updateSelectedLines(e.selections);
        }, 150);
      }),
    );
  }

  private updateSelectedLines(selections: readonly vscode.Selection[]): void {
    const newLines = new Set<number>();
    for (const sel of selections) {
      for (let line = sel.start.line; line <= sel.end.line; line++) {
        newLines.add(line + 1); // convert 0-based to 1-based
      }
    }

    // Only refresh if the set of selected lines actually changed
    if (setsEqual(this.selectedLines, newLines)) {
      return;
    }
    this.selectedLines = newLines;
    this._onDidChangeTreeData.fire();
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
    const lineData = await this.prIndex.getLineRangesForFile(uri);

    // getLineRangesForFile internally calls getPRsForFile, so we also need
    // the full PR list for files that have PRs but no line-level data yet.
    const prs = await this.prIndex.getPRsForFile(uri);
    if (prs.length === 0) {
      return [];
    }

    const lineDataByPR = new Map<number, string>();
    const rangesByPR = new Map<number, LineRange[]>();
    for (const entry of lineData) {
      const rangeStr = entry.ranges
        .map(r => r.startLine === r.endLine ? `L${r.startLine}` : `L${r.startLine}-${r.endLine}`)
        .join(', ');
      lineDataByPR.set(entry.pr.number, rangeStr);
      rangesByPR.set(entry.pr.number, entry.ranges);
    }

    return prs.map(pr => {
      const ranges = rangesByPR.get(pr.number) ?? [];
      const isSelected = this.selectedLines.size > 0
        && ranges.some(r => rangeOverlapsLines(r, this.selectedLines));
      return new PRTreeItem(pr, lineDataByPR.get(pr.number), isSelected);
    });
  }

  dispose(): void {
    clearTimeout(this.selectionDebounceTimer);
    this._onDidChangeTreeData.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function rangeOverlapsLines(range: LineRange, lines: Set<number>): boolean {
  for (let l = range.startLine; l <= range.endLine; l++) {
    if (lines.has(l)) {
      return true;
    }
  }
  return false;
}

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const v of a) {
    if (!b.has(v)) {
      return false;
    }
  }
  return true;
}
