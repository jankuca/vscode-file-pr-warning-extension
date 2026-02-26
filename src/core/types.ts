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
  createdAt: string;
  updatedAt: string;
  files: string[];
  filesIncomplete: boolean;
}

export interface LineRange {
  startLine: number;
  endLine: number;
}

export interface PRLineData {
  pr: PRInfo;
  ranges: LineRange[];
}

export interface RepoCacheEntry {
  prs: PRInfo[];
  fileIndex: Map<string, PRInfo[]>;
  fetchedAt: number;
  lineDiffCache: Map<string, Map<number, LineRange[]>>; // filePath -> prNumber -> ranges
}
