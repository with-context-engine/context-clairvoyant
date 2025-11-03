import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

export const getSubscription = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await getSubscriptionInternal(ctx, args.userId);
	},
});

export const createDefaultSubscription = internalMutation({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db.insert("subscriptions", {
			userId: args.userId,
			tier: "free",
			status: "active",
		});
	},
});

export const updateFromPolar = mutation({
	args: {
		userId: v.id("users"),
		tier: v.string(),
		status: v.string(),
		polarSubscriptionId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const subscription = await getSubscriptionInternal(ctx, args.userId);
		if (!subscription) {
			return await ctx.db.insert("subscriptions", {
				userId: args.userId,
				tier: args.tier,
				status: args.status,
				polarSubscriptionId: args.polarSubscriptionId,
				polarCustomerId: args.polarCustomerId,
			});
		}
		return await ctx.db.patch(subscription._id, {
			tier: args.tier,
			status: args.status,
			polarSubscriptionId: args.polarSubscriptionId,
			polarCustomerId: args.polarCustomerId,
		});
	},
});

async function getSubscriptionInternal(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
	return await ctx.db
		.query("subscriptions")
		.withIndex("by_user", (q) => q.eq("userId", userId))
		.first();
}
