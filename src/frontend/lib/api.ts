import { treaty } from "@elysiajs/eden";
import type { App } from "../../api";

export const api = treaty<App>("/");

/**
 * Helper function to make authenticated API calls
 * @param token - The JWT token (convexToken from useConvexAuth)
 * @returns A treaty instance with Authorization header set
 */
export function getAuthenticatedApi(token: string) {
	return treaty<App>("/", {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});
}
