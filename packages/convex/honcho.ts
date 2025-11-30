"use node";

import { randomUUID } from "node:crypto";
import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
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
 * Adds billing information as a memory to the user's diatribe peer in Honcho.
 * This action is called when a subscription is created to store the user's
 * billing details as persistent memory for personalization.
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
	handler: async (_ctx, args) => {
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
