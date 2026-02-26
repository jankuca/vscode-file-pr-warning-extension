"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePatchToHunks = parsePatchToHunks;
exports.mapHunksToLocalFile = mapHunksToLocalFile;
const HUNK_HEADER_REGEX = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/;
/**
 * Parse a unified diff patch into hunks containing the text of deleted/modified lines.
 * These hunks carry the actual content so we can later match against the user's local file
 * instead of relying on line numbers from the merge base.
 */
function parsePatchToHunks(patch) {
    const hunks = [];
    const lines = patch.split('\n');
    let oldLine = 0;
    let deletedLines = [];
    let groupStart = 0;
    function flush() {
        if (deletedLines.length > 0) {
            hunks.push({ oldStartLine: groupStart, deletedLines: [...deletedLines] });
            deletedLines = [];
        }
    }
    for (const line of lines) {
        const hunkMatch = line.match(HUNK_HEADER_REGEX);
        if (hunkMatch) {
            flush();
            oldLine = parseInt(hunkMatch[1], 10);
            continue;
        }
        if (line.startsWith('-')) {
            if (deletedLines.length === 0) {
                groupStart = oldLine;
            }
            deletedLines.push(line.slice(1)); // strip '-' prefix
            oldLine++;
        }
        else if (line.startsWith('+')) {
            // Added line — only in the PR branch, flush any pending deleted group
            flush();
        }
        else {
            // Context line or no-newline marker
            flush();
            if (!line.startsWith('\\')) {
                oldLine++;
            }
        }
    }
    flush();
    return hunks;
}
/**
 * Map diff hunks to actual line ranges in a local file by searching for the
 * deleted-line content. Uses the old line number as a proximity hint.
 */
function mapHunksToLocalFile(hunks, localContent) {
    const fileLines = localContent.split('\n');
    const ranges = [];
    for (const hunk of hunks) {
        if (hunk.deletedLines.length === 0) {
            continue;
        }
        const found = findSequenceNear(fileLines, hunk.deletedLines, hunk.oldStartLine - 1);
        if (found !== -1) {
            ranges.push({
                startLine: found + 1, // 1-based
                endLine: found + hunk.deletedLines.length,
            });
        }
    }
    return ranges;
}
/** Search for a sequence of lines near a hint position, expanding outward. */
function findSequenceNear(haystack, needle, hint) {
    hint = Math.max(0, Math.min(hint, haystack.length - 1));
    if (matchesAt(haystack, needle, hint)) {
        return hint;
    }
    const maxDelta = Math.max(hint, haystack.length - hint);
    for (let delta = 1; delta <= maxDelta; delta++) {
        if (hint - delta >= 0 && matchesAt(haystack, needle, hint - delta)) {
            return hint - delta;
        }
        if (hint + delta <= haystack.length - needle.length && matchesAt(haystack, needle, hint + delta)) {
            return hint + delta;
        }
    }
    return -1;
}
function matchesAt(haystack, needle, index) {
    if (index < 0 || index + needle.length > haystack.length) {
        return false;
    }
    for (let i = 0; i < needle.length; i++) {
        if (haystack[index + i] !== needle[i]) {
            return false;
        }
    }
    return true;
}
//# sourceMappingURL=diffParser.js.map