/**
 * Utility functions shared across the application
 */

/**
 * Converts an ISO timestamp to a human-readable "time ago" format
 * @param timestamp ISO 8601 timestamp string
 * @returns Human-readable time ago string (e.g., "2 hours ago", "yesterday")
 */
export function getTimeAgo(timestamp: string): string {
	try {
		const now = new Date();
		const then = new Date(timestamp);
		const diffMs = now.getTime() - then.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) {
			return diffMins <= 1 ? "just now" : `${diffMins} minutes ago`;
		}
		if (diffHours < 24) {
			return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
		}
		if (diffDays < 7) {
			return diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
		}
		if (diffDays < 30) {
			const weeks = Math.floor(diffDays / 7);
			return weeks === 1 ? "last week" : `${weeks} weeks ago`;
		}
		const months = Math.floor(diffDays / 30);
		return months === 1 ? "last month" : `${months} months ago`;
	} catch {
		return "recently";
	}
}
