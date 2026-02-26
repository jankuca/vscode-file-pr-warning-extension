import * as vscode from 'vscode';
import { GitService } from './git/gitService';
import { GitDiffService } from './git/gitDiffService';
import { AuthService } from './github/authService';
import { GitHubClient } from './github/githubClient';
import { PRIndex } from './core/prIndex';
import { PRCodeLensProvider } from './providers/codeLensProvider';
import { LineHighlighter } from './providers/lineHighlighter';
import { PRTreeDataProvider } from './providers/prTreeDataProvider';
import { PRFileDecorationProvider } from './providers/decorationProvider';
import { registerCommands } from './commands/commands';
import { timeAgo } from './core/timeAgo';

let gitService: GitService;
let gitDiffService: GitDiffService;
let authService: AuthService;
let githubClient: GitHubClient;
let prIndex: PRIndex;
let codeLensProvider: PRCodeLensProvider;
let lineHighlighter: LineHighlighter;
let prTreeDataProvider: PRTreeDataProvider;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Initialize git service
  gitService = new GitService();
  const gitReady = await gitService.initialize();
  if (!gitReady) {
    // No git — extension stays dormant
    return;
  }

  // Initialize services
  gitDiffService = new GitDiffService();
  authService = new AuthService();
  githubClient = new GitHubClient();
  prIndex = new PRIndex(gitService, authService, githubClient, gitDiffService);

  // Register commands
  registerCommands(context, prIndex);

  // Register CodeLens provider
  codeLensProvider = new PRCodeLensProvider(prIndex);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { scheme: 'file' },
      codeLensProvider
    )
  );

  // Initialize line highlighter
  lineHighlighter = new LineHighlighter(prIndex, context.extensionUri);

  // Register Tree View
  prTreeDataProvider = new PRTreeDataProvider(prIndex);
  const treeView = vscode.window.createTreeView('filePrWarning.prListView', {
    treeDataProvider: prTreeDataProvider,
  });

  // Register file decoration provider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new PRFileDecorationProvider(prIndex))
  );

  // Freshness indicator — update tree view description with fetch age
  function updateFreshnessIndicator() {
    if (prIndex.lastFetchError || gitDiffService.lastRemoteFetchError) {
      treeView.description = '\u26A0 Fetch failed';
    } else if (prIndex.lastFetchedAt) {
      treeView.description = `Fetched ${timeAgo(prIndex.lastFetchedAt)}`;
    } else {
      treeView.description = undefined;
    }
  }

  const freshnessTimer = setInterval(updateFreshnessIndicator, 30_000);

  context.subscriptions.push(
    treeView,
    prTreeDataProvider,
    prIndex.onDidChangeData(() => updateFreshnessIndicator()),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document.uri.scheme === 'file') {
        const fileName = editor.document.uri.path.split('/').pop() ?? '';
        treeView.title = `Open PRs: ${fileName}`;
      } else {
        treeView.title = 'Open PRs';
      }
    }),
    vscode.commands.registerCommand('filePrWarning.refreshTreeView', async () => {
      try {
        await prIndex.forceRefresh();
      } catch (e) {
        console.error('filePrWarning: refresh failed', e);
      }
    }),
    { dispose: () => clearInterval(freshnessTimer) },
  );

  // Start auto-refresh if enabled
  const config = vscode.workspace.getConfiguration('filePrWarning');
  if (config.get<boolean>('enabled')) {
    const refreshInterval = config.get<number>('refreshIntervalMinutes') ?? 10;
    prIndex.startAutoRefresh(refreshInterval);
  }

  // React to configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (!e.affectsConfiguration('filePrWarning')) {
        return;
      }

      const updatedConfig = vscode.workspace.getConfiguration('filePrWarning');

      if (e.affectsConfiguration('filePrWarning.refreshIntervalMinutes')) {
        if (updatedConfig.get<boolean>('enabled')) {
          const interval = updatedConfig.get<number>('refreshIntervalMinutes') ?? 10;
          prIndex.startAutoRefresh(interval);
        }
      }

      if (e.affectsConfiguration('filePrWarning.showCodeLens')) {
        // CodeLens provider will re-evaluate on next request
        codeLensProvider.refresh();
      }

      if (e.affectsConfiguration('filePrWarning.showLineHighlights')) {
        if (!updatedConfig.get<boolean>('showLineHighlights')) {
          lineHighlighter.clearDecorations();
        } else {
          lineHighlighter.updateActiveEditor();
        }
      }

      if (e.affectsConfiguration('filePrWarning.excludeDraftPRs')) {
        // Data needs re-filtering
        prIndex.invalidate();
      }

      if (e.affectsConfiguration('filePrWarning.enabled')) {
        if (!updatedConfig.get<boolean>('enabled')) {
          // Disable everything
          prIndex.stopAutoRefresh();
          lineHighlighter.clearDecorations();
          codeLensProvider.refresh();
        } else {
          // Re-enable
          const interval = updatedConfig.get<number>('refreshIntervalMinutes') ?? 10;
          prIndex.startAutoRefresh(interval);
          prIndex.invalidate();
        }
      }
    })
  );

  // Trigger initial fetch for the active editor (if enabled)
  if (config.get<boolean>('enabled') && vscode.window.activeTextEditor) {
    prIndex.getPRsForFile(vscode.window.activeTextEditor.document.uri);
  }

  // Fetch when files are opened
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document.uri.scheme === 'file') {
        prIndex.getPRsForFile(editor.document.uri);
      }
    })
  );

  // Register disposables
  context.subscriptions.push(
    gitService,
    gitDiffService,
    authService,
    prIndex,
    codeLensProvider,
    lineHighlighter
  );
}

export function deactivate(): void {
  // Cleanup is handled by disposables registered in context.subscriptions
}
