import { Polar } from "@convex-dev/polar";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, query } from "./_generated/server";

export const getFirstUser = query({
	handler: async (ctx) => {
		const user = await ctx.db.query("users").first();
		if (!user) {
			throw new Error("No user found");
		}
		return {
			_id: user._id,
			email: user.mentraUserId,
		};
	},
});

export const polar = new Polar(components.polar, {
	getUserInfo: async (ctx): Promise<{ userId: Id<"users">; email: string }> => {
		const user: { _id: Id<"users">; email: string } = await ctx.runQuery(
			api.polar.getFirstUser,
		);
		return {
			userId: user._id,
			email: user.email,
		};
	},
	server: "sandbox",
});

export const getCurrentUserWithSubscription = query({
	handler: async (ctx) => {
		const user = await ctx.db.query("users").first();
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

export const {
	listAllProducts,
	generateCheckoutLink,
	generateCustomerPortalUrl,
} = polar.api();

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
