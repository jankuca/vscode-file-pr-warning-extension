import * as vscode from 'vscode';
import { PRInfo, DiffHunk } from '../core/types';
import { OPEN_PRS_QUERY, GraphQLPRResponse, GraphQLPRNode, RESTFileEntry } from './queries';
import { parsePatchToHunks } from '../core/diffParser';

const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';
const GITHUB_API_URL = 'https://api.github.com';

export interface RateLimitState {
  remaining: number | null;
  resetAt: number | null;
}

export class GitHubClient {
  private rateLimitState: RateLimitState = { remaining: null, resetAt: null };

  get rateLimit(): RateLimitState {
    return { ...this.rateLimitState };
  }

  isRateLimited(): boolean {
    if (this.rateLimitState.remaining === null) {
      return false;
    }
    if (this.rateLimitState.remaining > 0) {
      return false;
    }
    if (this.rateLimitState.resetAt && Date.now() > this.rateLimitState.resetAt) {
      return false; // Reset time has passed
    }
    return true;
  }

  async fetchOpenPRs(owner: string, repo: string, token: string): Promise<PRInfo[]> {
    if (this.isRateLimited()) {
      const resetAt = this.rateLimitState.resetAt;
      const retryIn = resetAt ? Math.ceil((resetAt - Date.now()) / 60000) : '?';
      throw new RateLimitError(`GitHub API rate limit exceeded. Resets in ~${retryIn} min.`);
    }

    const prs: PRInfo[] = [];
    let cursor: string | null = null;

    do {
      const variables: Record<string, unknown> = { owner, repo };
      if (cursor) {
        variables.cursor = cursor;
      }

      const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: OPEN_PRS_QUERY, variables }),
      });

      this.updateRateLimit(response.headers);

      if (response.status === 401) {
        throw new AuthError('GitHub token is invalid or expired');
      }

      if (response.status === 403 && this.rateLimitState.remaining === 0) {
        throw new RateLimitError('GitHub API rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as GraphQLPRResponse;

      if (json.errors?.length) {
        throw new Error(`GitHub GraphQL error: ${json.errors[0].message}`);
      }

      const data = json.data.repository.pullRequests;

      for (const node of data.nodes) {
        prs.push(this.mapNodeToPR(node));
      }

      cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
    } while (cursor);

    return prs;
  }

  async fetchFileDiff(
    owner: string,
    repo: string,
    prNumber: number,
    filePath: string,
    token: string
  ): Promise<DiffHunk[]> {
    if (this.isRateLimited()) {
      return [];
    }

    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    this.updateRateLimit(response.headers);

    if (response.status === 401) {
      throw new AuthError('GitHub token is invalid or expired');
    }

    if (!response.ok) {
      return [];
    }

    const files = (await response.json()) as RESTFileEntry[];
    const file = files.find(f => f.filename === filePath);

    if (!file || !file.patch) {
      return [];
    }

    return parsePatchToHunks(file.patch);
  }

  private mapNodeToPR(node: GraphQLPRNode): PRInfo {
    return {
      number: node.number,
      title: node.title,
      url: node.url,
      author: node.author?.login ?? 'unknown',
      headRefName: node.headRefName,
      isDraft: node.isDraft,
      reviewDecision: node.reviewDecision,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      files: node.files.nodes.map(f => f.path),
      filesIncomplete: node.files.pageInfo.hasNextPage,
    };
  }

  private updateRateLimit(headers: Headers): void {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining !== null) {
      this.rateLimitState.remaining = parseInt(remaining, 10);
    }
    if (reset !== null) {
      this.rateLimitState.resetAt = parseInt(reset, 10) * 1000;
    }

    // Warn when rate limit is getting low
    if (this.rateLimitState.remaining !== null && this.rateLimitState.remaining < 100 && this.rateLimitState.remaining > 0) {
      if (this.rateLimitState.remaining % 50 === 0) {
        vscode.window.showWarningMessage(
          `File PR Warning: GitHub API rate limit low (${this.rateLimitState.remaining} remaining)`
        );
      }
    }
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}
