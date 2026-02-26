import { PRInfo } from './types';
export type PRColor = 'approved' | 'open' | 'stale' | 'draft';
export declare const COLOR_HEX: Record<PRColor, string>;
export declare function getPRColor(pr: PRInfo): PRColor;
/** Return the most urgent color from a set of PRs. */
export declare function getMostUrgentColor(prs: PRInfo[]): PRColor;
//# sourceMappingURL=prColors.d.ts.map