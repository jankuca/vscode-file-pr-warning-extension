import { PRInfo } from './types';

export type PRColor = 'approved' | 'open' | 'stale' | 'draft';

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/** Higher number = more urgent. */
const COLOR_PRIORITY: Record<PRColor, number> = {
  draft: 0,
  stale: 1,
  open: 2,
  approved: 3,
};

export const COLOR_HEX: Record<PRColor, string> = {
  approved: '#4caf50',
  open: '#00acc1',
  stale: '#616161',
  draft: '#9e9e9e',
};

export function getPRColor(pr: PRInfo): PRColor {
  if (pr.isDraft) { return 'draft'; }
  const isStale = Date.now() - new Date(pr.updatedAt).getTime() > TWO_WEEKS_MS;
  if (isStale) { return 'stale'; }
  if (pr.reviewDecision === 'APPROVED') { return 'approved'; }
  return 'open';
}

/** Return the most urgent color from a set of PRs. */
export function getMostUrgentColor(prs: PRInfo[]): PRColor {
  let best: PRColor = 'draft';
  for (const pr of prs) {
    const c = getPRColor(pr);
    if (COLOR_PRIORITY[c] > COLOR_PRIORITY[best]) {
      best = c;
    }
  }
  return best;
}
