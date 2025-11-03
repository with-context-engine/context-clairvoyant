import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const createCheckoutSession = action({
	args: {
		userId: v.id("users"),
		productId: v.string(),
		successUrl: v.string(),
		cancelUrl: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<{ checkoutUrl: string; checkoutId: string }> => {
		const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
		if (!polarAccessToken) {
			throw new Error("POLAR_ACCESS_TOKEN not configured");
		}

		const user = await ctx.runQuery(api.users.getByMentraId, {
			mentraUserId: args.userId,
		});

		if (!user) {
			throw new Error("User not found");
		}

		const response = await fetch("https://api.polar.sh/v1/checkouts/custom", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${polarAccessToken}`,
			},
			body: JSON.stringify({
				product_id: args.productId,
				success_url: args.successUrl,
				customer_email: user.mentraUserId,
				metadata: {
					userId: args.userId,
					mentraUserId: user.mentraUserId,
				},
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Polar checkout failed: ${error}`);
		}

		const checkout = (await response.json()) as { url: string; id: string };
		return {
			checkoutUrl: checkout.url,
			checkoutId: checkout.id,
		};
	},
});
