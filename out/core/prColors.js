"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLOR_HEX = void 0;
exports.getPRColor = getPRColor;
exports.getMostUrgentColor = getMostUrgentColor;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
/** Higher number = more urgent. */
const COLOR_PRIORITY = {
    draft: 0,
    stale: 1,
    open: 2,
    approved: 3,
};
exports.COLOR_HEX = {
    approved: '#4caf50',
    open: '#00acc1',
    stale: '#616161',
    draft: '#9e9e9e',
};
function getPRColor(pr) {
    if (pr.isDraft) {
        return 'draft';
    }
    const isStale = Date.now() - new Date(pr.updatedAt).getTime() > TWO_WEEKS_MS;
    if (isStale) {
        return 'stale';
    }
    if (pr.reviewDecision === 'APPROVED') {
        return 'approved';
    }
    return 'open';
}
/** Return the most urgent color from a set of PRs. */
function getMostUrgentColor(prs) {
    let best = 'draft';
    for (const pr of prs) {
        const c = getPRColor(pr);
        if (COLOR_PRIORITY[c] > COLOR_PRIORITY[best]) {
            best = c;
        }
    }
    return best;
}
//# sourceMappingURL=prColors.js.map