import { LineRange } from './types';

const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/;

export function parsePatchToLineRanges(patch: string): LineRange[] {
  const ranges: LineRange[] = [];
  const lines = patch.split('\n');

  let oldLine = 0;
  let rangeStart: number | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch) {
      // Flush any pending range
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: oldLine - 1 });
        rangeStart = null;
      }

      oldLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('-')) {
      // Deleted/modified line in the old (base) file — highlight these
      if (rangeStart === null) {
        rangeStart = oldLine;
      }
      oldLine++;
    } else if (line.startsWith('+')) {
      // Added line — only exists in the PR branch, not in the user's file
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: oldLine - 1 });
        rangeStart = null;
      }
    } else {
      // Context line or no-newline marker
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: oldLine - 1 });
        rangeStart = null;
      }
      if (!line.startsWith('\\')) {
        oldLine++;
      }
    }
  }

  // Flush final range
  if (rangeStart !== null) {
    ranges.push({ startLine: rangeStart, endLine: oldLine - 1 });
  }

  return ranges;
}
