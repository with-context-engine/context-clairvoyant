import { treaty } from "@elysiajs/eden";
import type { App } from "@clairvoyant/api";
import { apiBaseUrl } from "../env";

export const api = treaty<App>(apiBaseUrl);

/**
 * Helper function to make authenticated API calls
 * @param token - The JWT token (convexToken from useConvexAuth)
 * @returns A treaty instance with Authorization header set
 */
export function getAuthenticatedApi(token: string) {
	return treaty<App>(apiBaseUrl, {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}
