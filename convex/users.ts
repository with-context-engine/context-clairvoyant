import { v } from "convex/values";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

export const getByMentraId = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		return await getByMentraIdInternal(ctx, args.mentraUserId);
	},
});

export const getOrCreate = mutation({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const existing = await getByMentraIdInternal(ctx, args.mentraUserId);
		if (existing) {
			return existing._id;
		}
		return await createUserInternal(ctx, args.mentraUserId);
	},
});

async function getByMentraIdInternal(ctx: QueryCtx | MutationCtx, mentraUserId: string) {
	return await ctx.db
		.query("users")
		.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", mentraUserId))
		.first();
}

async function createUserInternal(ctx: MutationCtx, mentraUserId: string) {
	const userId = await ctx.db.insert("users", { mentraUserId });
	await ctx.scheduler.runAfter(0, internal.subscriptions.createDefaultSubscription, {
		userId,
	});
	return userId;
}
