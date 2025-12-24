import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const createHonchoSession = mutation({
	args: {
		mentraUserId: v.string(),
		mentraSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			throw new Error(`User not found for mentraUserId: ${args.mentraUserId}`);
		}

		const honchoSessionId = crypto.randomUUID();

		await ctx.db.insert("honchoSessions", {
			userId: user._id,
			mentraSessionId: args.mentraSessionId,
			honchoSessionId,
			createdAt: new Date().toISOString(),
		});

		return honchoSessionId;
	},
});

export const getHonchoSession = query({
	args: {
		mentraSessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("honchoSessions")
			.withIndex("by_mentra_session", (q) =>
				q.eq("mentraSessionId", args.mentraSessionId),
			)
			.first();

		return session?.honchoSessionId ?? null;
	},
});

export const getRecentForUser = query({
	args: {
		mentraUserId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			return [];
		}

		const sessions = await ctx.db
			.query("honchoSessions")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(args.limit ?? 10);

		return sessions.map((s) => ({
			honchoSessionId: s.honchoSessionId,
			createdAt: s.createdAt,
		}));
	},
});
