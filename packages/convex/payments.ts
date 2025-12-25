import { Polar } from "@convex-dev/polar";
import { Polar as PolarSDK } from "@polar-sh/sdk";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	query,
} from "./_generated/server";

// =============================================================================
// Polar Types (inferred from polar.listProducts return type)
// =============================================================================

export type PolarPrice = {
	id: string;
	priceAmount?: number;
	priceCurrency?: string;
	recurringInterval?: "day" | "week" | "month" | "year" | null;
	amountType?: string;
	createdAt: string;
	isArchived: boolean;
	maximumAmount?: number | null;
	minimumAmount?: number | null;
	modifiedAt: string | null;
	presetAmount?: number | null;
	productId: string;
	type?: string;
};

export type PolarProduct = {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
	modifiedAt: string | null;
	isArchived: boolean;
	isRecurring: boolean;
	organizationId: string;
	priceAmount?: number;
	recurringInterval?: "day" | "week" | "month" | "year" | null;
	prices: PolarPrice[];
	medias: Array<{
		id: string;
		name: string;
		publicUrl: string;
		mimeType: string;
		size: number;
		sizeReadable: string;
		checksumEtag: string | null;
		checksumSha256Base64: string | null;
		checksumSha256Hex: string | null;
		createdAt: string;
		isUploaded: boolean;
		lastModifiedAt: string | null;
		organizationId: string;
		path: string;
		service?: string;
		storageVersion: string | null;
		version: string | null;
	}>;
	metadata?: Record<string, unknown>;
};

// =============================================================================
// Polar Configuration
// =============================================================================

export const polar = new Polar(components.polar, {
	getUserInfo: async (ctx): Promise<{ userId: Id<"users">; email: string }> => {
		const user = await ctx.runQuery(api.users.getCurrentUser);
		return {
			userId: user._id,
			email: user.email,
		};
	},
	server: process.env.POLAR_SERVER as "production" | "sandbox" | undefined,
});

// =============================================================================
// Public Actions (from polar.api())
// =============================================================================

export const {
	changeCurrentSubscription,
	cancelCurrentSubscription,
	getConfiguredProducts,
	listAllProducts,
	generateCheckoutLink,
	generateCustomerPortalUrl,
} = polar.api();

// =============================================================================
// Public Queries
// =============================================================================

export const getCurrentUserWithSubscription = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();
		if (!user) return null;

		const subscription = await polar.getCurrentSubscription(ctx, {
			userId: user._id,
		});

		return {
			...user,
			subscription,
			isFree: !subscription,
			isPro: !!subscription,
		};
	},
});

// =============================================================================
// Public Actions
// =============================================================================

export const syncProductsFromPolar = action({
	handler: async (ctx) => {
		try {
			console.log("[Polar] Starting product sync from sandbox...");
			await polar.syncProducts(ctx);
			console.log("[Polar] Product sync completed successfully");
			return { success: true, message: "Products synced from Polar" };
		} catch (error) {
			console.error("[Polar] Sync failed:", error);
			throw new Error(
				`Failed to sync products from Polar: ${error instanceof Error ? error.message : String(error)}. ` +
					"Check that POLAR_ORGANIZATION_TOKEN is valid.",
			);
		}
	},
});

export const getCustomerInfo = action({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		// Get the user from Convex database
		const user = await ctx.runQuery(api.users.getByMentraId, {
			mentraUserId: args.mentraUserId,
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Get the customer from the Polar component
		const customer = await ctx.runQuery(
			components.polar.lib.getCustomerByUserId,
			{
				userId: user._id,
			},
		);

		if (!customer) {
			throw new Error("Customer not found in Polar component");
		}

		// Initialize Polar SDK
		const accessToken =
			process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_ORGANIZATION_TOKEN;
		if (!accessToken) {
			throw new Error(
				"POLAR_ACCESS_TOKEN or POLAR_ORGANIZATION_TOKEN environment variable is not set",
			);
		}

		const polarSDK = new PolarSDK({
			accessToken,
			server: process.env.POLAR_SERVER as "production" | "sandbox" | undefined,
		});

		// Fetch customer information from Polar API
		const result = await polarSDK.customers.get({
			id: customer.id,
		});

		// Return only the name and billing address
		return {
			name: result.name || null,
			billingAddress: result.billingAddress || null,
		};
	},
});

// =============================================================================
// Internal Mutations
// =============================================================================

/**
 * Internal mutation to schedule the subscription created handler.
 * This is called from the webhook callback which runs in a mutation context.
 */
export const scheduleSubscriptionCreatedHandler = internalMutation({
	args: {
		userId: v.string(),
		customerId: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		await ctx.scheduler.runAfter(
			0,
			internal.payments.handleSubscriptionCreated,
			{
				userId: args.userId,
				customerId: args.customerId,
			},
		);
	},
});

// =============================================================================
// Internal Actions
// =============================================================================

/**
 * Internal action called by the webhook handler when a subscription is created.
 * Fetches billing info from Polar, stores it in Convex, and adds it to Honcho memory.
 */
export const handleSubscriptionCreated = internalAction({
	args: {
		userId: v.string(),
		customerId: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const { userId, customerId } = args;

		console.log(
			`[Polar] handleSubscriptionCreated called for userId: ${userId}`,
		);

		// The userId here is the Convex user._id (stored as externalId in Polar)
		// We need to get the customer info from Polar
		if (!customerId) {
			console.warn("[Polar] No customerId provided, cannot fetch billing info");
			return { success: false, reason: "no_customer_id" };
		}

		// Initialize Polar SDK
		const accessToken =
			process.env.POLAR_ACCESS_TOKEN ?? process.env.POLAR_ORGANIZATION_TOKEN;
		if (!accessToken) {
			console.error("[Polar] No access token available");
			return { success: false, reason: "no_access_token" };
		}

		const polarSDK = new PolarSDK({
			accessToken,
			server: process.env.POLAR_SERVER as "production" | "sandbox" | undefined,
		});

		try {
			const customerState = await polarSDK.customers.getState({
				id: customerId,
			});

			const billingName = customerState.name || null;
			const billingAddress = customerState.billingAddress;

			console.log(
				`[Polar] Retrieved billing info for customer ${customerId}: name=${billingName}`,
			);

			// Store billing info in Convex
			if (billingName || billingAddress) {
				// Convert billing address to the format expected by our schema
				const formattedBillingAddress = billingAddress
					? {
							city: billingAddress.city || "",
							country: billingAddress.country || "",
							line1: billingAddress.line1 || "",
							line2: billingAddress.line2 || undefined,
							postalCode: billingAddress.postalCode || "",
							state: billingAddress.state || "",
						}
					: undefined;

				await ctx.runMutation(internal.users.storeBillingInfo, {
					userId: userId as Id<"users">,
					billingName: billingName || undefined,
					billingAddress: formattedBillingAddress,
				});

				console.log(`[Polar] Stored billing info in Convex for user ${userId}`);

				// Add to Honcho memory
				await ctx.runAction(internal.honcho.addBillingMemory, {
					userId,
					billingName: billingName || undefined,
					billingAddress: formattedBillingAddress,
				});

				console.log(`[Polar] Added billing info to Honcho for user ${userId}`);
			}

			return { success: true };
		} catch (error) {
			console.error(
				`[Polar] Error in handleSubscriptionCreated: ${error instanceof Error ? error.message : String(error)}`,
			);
			return {
				success: false,
				reason: "error",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
});
