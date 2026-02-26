import * as vscode from 'vscode';
import * as path from 'path';
import { PRIndex } from '../core/prIndex';

export class LineHighlighter implements vscode.Disposable {
  private decorationType: vscode.TextEditorDecorationType;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private prIndex: PRIndex,
    private extensionUri: vscode.Uri
  ) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      overviewRulerColor: new vscode.ThemeColor('filePrWarning.lineHighlightBorder'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: vscode.Uri.joinPath(this.extensionUri, 'resources', 'gutter-warning.svg'),
      gutterIconSize: 'contain',
    });

    this.disposables.push(
      this.prIndex.onDidChangeData(() => this.updateActiveEditor()),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveEditor())
    );
  }

  async updateActiveEditor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const config = vscode.workspace.getConfiguration('filePrWarning');
    if (!config.get<boolean>('enabled') || !config.get<boolean>('showLineHighlights')) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    if (editor.document.uri.scheme !== 'file') {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const prLineData = await this.prIndex.getLineRangesForFile(editor.document.uri);
    if (prLineData.length === 0) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    // Build a map of line -> PRs for hover messages
    const lineMap = new Map<number, { prTitle: string; prNumber: number; prUrl: string; author: string }[]>();

    for (const { pr, ranges } of prLineData) {
      for (const range of ranges) {
        for (let line = range.startLine; line <= range.endLine; line++) {
          const existing = lineMap.get(line) ?? [];
          existing.push({
            prTitle: pr.title,
            prNumber: pr.number,
            prUrl: pr.url,
            author: pr.author,
          });
          lineMap.set(line, existing);
        }
      }
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const [line, prs] of lineMap) {
      // Lines from diff are 1-based, VSCode ranges are 0-based
      const lineIndex = line - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      const hover = new vscode.MarkdownString();
      hover.isTrusted = true;
      for (const pr of prs) {
        hover.appendMarkdown(`Modified by PR [#${pr.prNumber} ${pr.prTitle}](${pr.prUrl}) by @${pr.author}\n\n`);
      }

      decorations.push({
        range: new vscode.Range(lineIndex, 0, lineIndex, 0),
        hoverMessage: hover,
      });
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  clearDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this.decorationType, []);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
