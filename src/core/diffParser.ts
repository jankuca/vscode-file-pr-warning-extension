import { LineRange } from './types';

const HUNK_HEADER_REGEX = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parsePatchToLineRanges(patch: string): LineRange[] {
  const ranges: LineRange[] = [];
  const lines = patch.split('\n');

  let newLine = 0;
  let rangeStart: number | null = null;

  for (const line of lines) {
    const hunkMatch = line.match(HUNK_HEADER_REGEX);
    if (hunkMatch) {
      // Flush any pending range
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: newLine - 1 });
        rangeStart = null;
      }

      newLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith('+')) {
      if (rangeStart === null) {
        rangeStart = newLine;
      }
      newLine++;
    } else if (line.startsWith('-')) {
      // Deleted line — does not advance new-file line number
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: newLine - 1 });
        rangeStart = null;
      }
    } else {
      // Context line or no-newline marker
      if (rangeStart !== null) {
        ranges.push({ startLine: rangeStart, endLine: newLine - 1 });
        rangeStart = null;
      }
      if (!line.startsWith('\\')) {
        newLine++;
      }
    }
  }

  // Flush final range
  if (rangeStart !== null) {
    ranges.push({ startLine: rangeStart, endLine: newLine - 1 });
  }

  return ranges;
}
