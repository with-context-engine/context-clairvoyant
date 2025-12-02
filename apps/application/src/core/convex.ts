import { api } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { env } from "./env";

const client = new ConvexHttpClient(env.CONVEX_URL);

export async function getUserPreferences(mentraUserId: string) {
	try {
		const prefs = await client.query(api.users.getPreferencesByMentraId, {
			mentraUserId,
		});
		return prefs;
	} catch (error) {
		console.error("[Convex] Failed to fetch user preferences:", error);
		return {
			weatherUnit: "C" as const,
			defaultLocation: undefined,
		};
	}
}

/**
 * Fetches and parses the user's default location from preferences.
 * The location is stored as a JSON string: '{"lat": number, "lng": number}'
 * @returns The parsed location object or null if not available/invalid
 */
export async function getDefaultLocation(
	mentraUserId: string,
): Promise<{ lat: number; lng: number } | null> {
	try {
		const prefs = await getUserPreferences(mentraUserId);
		if (!prefs.defaultLocation) {
			return null;
		}

		const location = JSON.parse(prefs.defaultLocation) as {
			lat?: number;
			lng?: number;
		};

		if (typeof location.lat !== "number" || typeof location.lng !== "number") {
			console.warn(
				"[Convex] Invalid defaultLocation format:",
				prefs.defaultLocation,
			);
			return null;
		}

		return { lat: location.lat, lng: location.lng };
	} catch (error) {
		console.error("[Convex] Failed to parse default location:", error);
		return null;
	}
}

export async function checkUserIsPro(mentraUserId: string): Promise<boolean> {
	try {
		const user = await client.query(
			api.payments.getCurrentUserWithSubscription,
			{
				mentraUserId,
			},
		);
		return user?.isPro ?? false;
	} catch (error) {
		console.error("[Convex] Failed to check Pro status:", error);
		return false;
	}
}

export async function recordToolInvocation(
	mentraUserId: string,
	router: string,
	date?: string,
) {
	try {
		await client.mutation(api.analytics.increment, {
			mentraUserId,
			router,
			date,
		});
	} catch (error) {
		console.error("[Convex] Failed to record tool invocation:", error);
	}
}

export { client as convexClient };
