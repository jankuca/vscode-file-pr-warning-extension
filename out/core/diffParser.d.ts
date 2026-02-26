import { DiffHunk, LineRange } from './types';
/**
 * Extract just the patch portion (from the first @@ header) from a full
 * `git diff` output. Strips `diff --git`, `index`, `---`, `+++` preamble
 * whose `-`/`+` prefixes would confuse `parsePatchToHunks`.
 */
export declare function extractPatchFromDiff(diffOutput: string): string | null;
/**
 * Parse a unified diff patch into hunks containing the text of deleted/modified lines.
 * These hunks carry the actual content so we can later match against the user's local file
 * instead of relying on line numbers from the merge base.
 */
export declare function parsePatchToHunks(patch: string): DiffHunk[];
/**
 * Map diff hunks to actual line ranges in a local file by searching for the
 * deleted-line content. Uses the old line number as a proximity hint.
 */
export declare function mapHunksToLocalFile(hunks: DiffHunk[], localContent: string): LineRange[];
//# sourceMappingURL=diffParser.d.ts.map