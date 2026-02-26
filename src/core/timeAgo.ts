/**
 * Format a date (timestamp or ISO string) as a human-readable relative time.
 */
export function timeAgo(value: number | string): string {
  const timestamp = typeof value === 'string' ? new Date(value).getTime() : value;
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMonth > 0) {
    return diffMonth === 1 ? '1 month ago' : `${diffMonth} months ago`;
  }
  if (diffWeek > 0) {
    return diffWeek === 1 ? '1 week ago' : `${diffWeek} weeks ago`;
  }
  if (diffDay > 0) {
    return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  }
  if (diffHour > 0) {
    return diffHour === 1 ? '1 hour ago' : `${diffHour} hours ago`;
  }
  if (diffMin > 0) {
    return diffMin === 1 ? '1 min ago' : `${diffMin} min ago`;
  }
  return 'just now';
}
