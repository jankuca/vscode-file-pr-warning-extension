import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
import { PRInfo } from '../core/types';
import { PRColor, COLOR_HEX, getMostUrgentColor } from '../core/prColors';

type WidthLevel = 1 | 2 | 3 | 4;

const WIDTH_PX: Record<WidthLevel, number> = { 1: 2, 2: 3, 3: 4, 4: 5 };

function gutterSvgUri(color: string, width: number): vscode.Uri {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect fill="${color}" x="2" y="2" width="${width}" height="12" rx="1"/></svg>`;
  return vscode.Uri.parse(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
}

type VariantKey = `${PRColor}-${WidthLevel}`;

function makeKey(color: PRColor, width: WidthLevel): VariantKey {
  return `${color}-${width}`;
}

export class LineHighlighter implements vscode.Disposable {
  private decorationTypes = new Map<VariantKey, vscode.TextEditorDecorationType>();
  private disposables: vscode.Disposable[] = [];

  constructor(
    private prIndex: PRIndex,
    _extensionUri: vscode.Uri,
  ) {
    // Pre-create a decoration type for each color × width combination (4×4 = 16)
    const colors: PRColor[] = ['approved', 'open', 'stale', 'draft'];
    const widths: WidthLevel[] = [1, 2, 3, 4];

    for (const color of colors) {
      for (const w of widths) {
        const key = makeKey(color, w);
        const dt = vscode.window.createTextEditorDecorationType({
          overviewRulerColor: COLOR_HEX[color] + '60',
          overviewRulerLane: vscode.OverviewRulerLane.Left,
          gutterIconPath: gutterSvgUri(COLOR_HEX[color], WIDTH_PX[w]),
          gutterIconSize: 'contain',
        });
        this.decorationTypes.set(key, dt);
      }
    }

    this.disposables.push(
      this.prIndex.onDidChangeData(() => this.updateActiveEditor()),
      vscode.window.onDidChangeActiveTextEditor(() => this.updateActiveEditor()),
    );
  }

  async updateActiveEditor(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const config = vscode.workspace.getConfiguration('filePrWarning');
    if (!config.get<boolean>('enabled') || !config.get<boolean>('showLineHighlights')) {
      this.clearDecorations();
      return;
    }

    if (editor.document.uri.scheme !== 'file') {
      this.clearDecorations();
      return;
    }

    let prLineData;
    try {
      prLineData = await this.prIndex.getLineRangesForFile(editor.document.uri);
    } catch (e) {
      console.error('filePrWarning: getLineRangesForFile failed', e);
      this.clearDecorations();
      return;
    }
    if (prLineData.length === 0) {
      this.clearDecorations();
      return;
    }

    // Build per-line data: which PRs touch each line
    const lineMap = new Map<number, PRInfo[]>();

    for (const { pr, ranges } of prLineData) {
      for (const range of ranges) {
        for (let line = range.startLine; line <= range.endLine; line++) {
          const existing = lineMap.get(line) ?? [];
          existing.push(pr);
          lineMap.set(line, existing);
        }
      }
    }

    // Group decorations by variant key
    const grouped = new Map<VariantKey, vscode.DecorationOptions[]>();

    for (const [line, prs] of lineMap) {
      const lineIndex = line - 1;
      if (lineIndex < 0 || lineIndex >= editor.document.lineCount) {
        continue;
      }

      const color = getMostUrgentColor(prs);
      const widthLevel = Math.min(prs.length, 4) as WidthLevel;
      const key = makeKey(color, widthLevel);

      const hover = new vscode.MarkdownString();
      for (const pr of prs) {
        hover.appendMarkdown(`Modified by PR [#${pr.number} `);
        hover.appendText(pr.title);
        hover.appendMarkdown(`](${pr.url}) by @`);
        hover.appendText(pr.author);
        hover.appendMarkdown('\n\n');
      }

      const deco: vscode.DecorationOptions = {
        range: new vscode.Range(lineIndex, 0, lineIndex, 0),
        hoverMessage: hover,
      };

      const list = grouped.get(key);
      if (list) {
        list.push(deco);
      } else {
        grouped.set(key, [deco]);
      }
    }

    // Apply each variant; clear variants that have no lines this time
    for (const [key, dt] of this.decorationTypes) {
      editor.setDecorations(dt, grouped.get(key) ?? []);
    }
  }

  clearDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      for (const dt of this.decorationTypes.values()) {
        editor.setDecorations(dt, []);
      }
    }
  }

  dispose(): void {
    for (const dt of this.decorationTypes.values()) {
      dt.dispose();
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
