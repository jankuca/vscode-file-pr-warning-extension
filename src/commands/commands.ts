import * as vscode from 'vscode';
import { PRIndex } from '../core/prIndex';
import { PRInfo } from '../core/types';

export function registerCommands(
  context: vscode.ExtensionContext,
  prIndex: PRIndex
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('filePrWarning.showPRList', showPRList(prIndex)),
    vscode.commands.registerCommand('filePrWarning.refresh', refresh(prIndex))
  );
}

function showPRList(prIndex: PRIndex) {
  return async (uri?: vscode.Uri) => {
    const fileUri = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!fileUri) {
      return;
    }

    const prs = await prIndex.getPRsForFile(fileUri);
    if (prs.length === 0) {
      vscode.window.showInformationMessage('No open PRs modify this file.');
      return;
    }

    const items = prs.map(pr => ({
      label: `#${pr.number} ${pr.title}`,
      description: `by @${pr.author}`,
      detail: `Created ${timeAgo(pr.createdAt)} | Updated ${timeAgo(pr.updatedAt)}`,
      pr,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a PR to open in browser',
    });

    if (selected) {
      vscode.env.openExternal(vscode.Uri.parse(selected.pr.url));
    }
  };
}

function refresh(prIndex: PRIndex) {
  return async () => {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'File PR Warning: Refreshing PR data...',
        cancellable: false,
      },
      async () => {
        await prIndex.forceRefresh();
      }
    );
  };
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMonth > 0) {
    return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
  }
  if (diffWeek > 0) {
    return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
  }
  if (diffDay > 0) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  }
  if (diffHour > 0) {
    return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  }
  if (diffMin > 0) {
    return diffMin === 1 ? '1 minute ago' : `${diffMin} minutes ago`;
  }
  return 'just now';
}
