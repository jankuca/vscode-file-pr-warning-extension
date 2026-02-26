import { PRInfo, LineRange } from '../core/types';
export interface RateLimitState {
    remaining: number | null;
    resetAt: number | null;
}
export declare class GitHubClient {
    private rateLimitState;
    get rateLimit(): RateLimitState;
    isRateLimited(): boolean;
    fetchOpenPRs(owner: string, repo: string, token: string): Promise<PRInfo[]>;
    fetchFileDiff(owner: string, repo: string, prNumber: number, filePath: string, token: string): Promise<LineRange[]>;
    private mapNodeToPR;
    private updateRateLimit;
}
export declare class AuthError extends Error {
    constructor(message: string);
}
export declare class RateLimitError extends Error {
    constructor(message: string);
}
//# sourceMappingURL=githubClient.d.ts.map