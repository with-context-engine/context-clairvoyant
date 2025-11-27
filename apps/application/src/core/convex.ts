import { api } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { env } from "./env";

const client = new ConvexHttpClient(env.CONVEX_URL);

export async function getUserPreferences(mentraUserId: string) {
	try {
		const prefs = await client.query(api.preferences.getPreferencesByMentraId, {
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

export async function checkUserIsPro(mentraUserId: string): Promise<boolean> {
	try {
		const user = await client.query(api.polar.getCurrentUserWithSubscription, {
			mentraUserId,
		});
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
		await client.mutation(api.toolInvocations.increment, {
			mentraUserId,
			router,
			date,
		});
	} catch (error) {
		console.error("[Convex] Failed to record tool invocation:", error);
	}
}

export { client as convexClient };
