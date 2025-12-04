"use node";

import { randomUUID } from "node:crypto";
import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

/**
 * Formats billing address into a readable string
 */
function formatBillingAddress(address: {
	city: string;
	country: string;
	line1: string;
	line2?: string | null;
	postalCode: string;
	state: string;
}): string {
	const parts = [address.line1];
	if (address.line2) parts.push(address.line2);
	parts.push(`${address.city}, ${address.state} ${address.postalCode}`);
	parts.push(address.country);
	return parts.join(", ");
}

/**
 * Google Geocoding API response types
 */
interface GeocodeResponse {
	status: string;
	results: Array<{
		geometry: {
			location: {
				lat: number;
				lng: number;
			};
		};
	}>;
}

/**
 * Geocodes a billing address using Google Geocoding API
 * @returns { lat, lng } or null if geocoding fails
 */
async function geocodeBillingAddress(address: {
	city: string;
	country: string;
	line1: string;
	line2?: string | null;
	postalCode: string;
	state: string;
}): Promise<{ lat: number; lng: number } | null> {
	const apiKey = process.env.GOOGLE_MAPS_API_KEY;
	if (!apiKey) {
		console.error(
			"[Honcho] GOOGLE_MAPS_API_KEY environment variable is not set",
		);
		return null;
	}

	// Format address for geocoding API
	const formattedAddress = formatBillingAddress(address);
	const encodedAddress = encodeURIComponent(formattedAddress);
	const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			console.error(
				`[Honcho] Geocoding API HTTP error: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const data = (await response.json()) as GeocodeResponse;

		if (data.status !== "OK" || !data.results || data.results.length === 0) {
			console.warn(
				`[Honcho] Geocoding returned no results for address: ${formattedAddress}, status: ${data.status}`,
			);
			return null;
		}

		const location = data.results[0]?.geometry?.location;
		if (
			!location ||
			typeof location.lat !== "number" ||
			typeof location.lng !== "number"
		) {
			console.warn("[Honcho] Geocoding response missing location data");
			return null;
		}

		console.log(
			`[Honcho] Successfully geocoded address to lat=${location.lat}, lng=${location.lng}`,
		);
		return { lat: location.lat, lng: location.lng };
	} catch (error) {
		console.error(
			`[Honcho] Error geocoding address: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/**
 * Adds billing information as a memory to the user's diatribe peer in Honcho.
 * This action is called when a subscription is created to store the user's
 * billing details as persistent memory for personalization.
 * Also geocodes the billing address and stores the lat/lng as the user's default location.
 */
export const addBillingMemory = internalAction({
	args: {
		userId: v.string(),
		billingName: v.optional(v.string()),
		billingAddress: v.optional(
			v.object({
				city: v.string(),
				country: v.string(),
				line1: v.string(),
				line2: v.optional(v.string()),
				postalCode: v.string(),
				state: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const { userId, billingName, billingAddress } = args;

		// Skip if no billing information provided
		if (!billingName && !billingAddress) {
			console.log(
				"[Honcho] No billing information provided, skipping memory storage",
			);
			return { success: false, reason: "no_billing_info" };
		}

		const apiKey = process.env.HONCHO_API_KEY;
		if (!apiKey) {
			console.error("[Honcho] HONCHO_API_KEY environment variable is not set");
			return { success: false, reason: "missing_api_key" };
		}

		// Geocode the billing address and store as default location (runs in parallel with Honcho)
		let geocodePromise: Promise<void> | null = null;
		if (billingAddress) {
			geocodePromise = (async () => {
				const location = await geocodeBillingAddress(billingAddress);
				if (location) {
					try {
						await ctx.runMutation(internal.users.updateDefaultLocation, {
							userId: userId as Id<"users">,
							defaultLocation: JSON.stringify(location),
						});
						console.log(
							`[Honcho] Stored default location for user ${userId}: ${JSON.stringify(location)}`,
						);
					} catch (error) {
						console.error(
							`[Honcho] Failed to store default location for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}
			})();
		}

		try {
			const honchoClient = new Honcho({
				apiKey,
				workspaceId: "with-context",
			});

			// Create a session for this operation
			const session = await honchoClient.session(randomUUID());

			// Get or create the diatribe peer for this user
			const diatribePeer = await honchoClient.peer(`${userId}-diatribe`, {
				metadata: {
					name: "Diatribe",
					description:
						"A peer that listens to the raw translations of the users' speech.",
				},
			});

			await session.addPeers([diatribePeer]);

			// Format the billing information as a natural language memory
			const memoryParts: string[] = [];
			if (billingName) {
				memoryParts.push(`My name is ${billingName}.`);
			}
			if (billingAddress) {
				const formattedAddress = formatBillingAddress(billingAddress);
				memoryParts.push(`My billing address is ${formattedAddress}.`);
				if (billingAddress.city) {
					memoryParts.push(`I live in ${billingAddress.city}.`);
				}
			}

			const memoryContent = memoryParts.join(" ");

			// Add the memory message to the session
			await session.addMessages([
				{
					peer_id: diatribePeer.id,
					content: memoryContent,
					metadata: {
						timestamp: new Date().toISOString(),
						source: "billing_info",
						type: "user_profile",
					},
				},
			]);

			// Wait for geocoding to complete (if it was started)
			if (geocodePromise) {
				await geocodePromise;
			}

			console.log(
				`[Honcho] Successfully stored billing memory for user ${userId}`,
			);
			return { success: true };
		} catch (error) {
			console.error(
				`[Honcho] Error storing billing memory for user ${userId}:`,
				error,
			);
			return {
				success: false,
				reason: "honcho_error",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
});
