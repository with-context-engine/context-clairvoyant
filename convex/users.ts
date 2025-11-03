import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

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

async function getByMentraIdInternal(
	ctx: QueryCtx | MutationCtx,
	mentraUserId: string,
) {
	return await ctx.db
		.query("users")
		.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", mentraUserId))
		.first();
}

async function createUserInternal(ctx: MutationCtx, mentraUserId: string) {
	return await ctx.db.insert("users", { mentraUserId });
}
