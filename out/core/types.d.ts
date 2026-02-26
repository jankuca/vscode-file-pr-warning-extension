export interface RepoInfo {
    rootUri: string;
    owner: string;
    repo: string;
}
export interface PRInfo {
    number: number;
    title: string;
    url: string;
    author: string;
    headRefName: string;
    isDraft: boolean;
    reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
    createdAt: string;
    updatedAt: string;
    files: string[];
    filesIncomplete: boolean;
}
export interface LineRange {
    startLine: number;
    endLine: number;
}
/** A group of consecutive deleted/modified lines from a patch, with their text content. */
export interface DiffHunk {
    oldStartLine: number;
    deletedLines: string[];
}
export interface PRLineData {
    pr: PRInfo;
    ranges: LineRange[];
}
export interface RepoCacheEntry {
    prs: PRInfo[];
    fileIndex: Map<string, PRInfo[]>;
    fetchedAt: number;
    diffHunkCache: Map<string, Map<number, DiffHunk[]>>;
}
//# sourceMappingURL=types.d.ts.map