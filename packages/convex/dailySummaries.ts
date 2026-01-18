import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const getForUser = query({
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
			return { isPro: true, summaries: [] };
		}

		const limit = args.limit ?? 30;

		const summaries = await ctx.db
			.query("dailySummaries")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(limit);

		return {
			isPro: true,
			summaries: summaries.map((s) => ({
				date: s.date,
				summary: s.summary,
				topics: s.topics,
				sessionCount: s.sessionCount,
			})),
		};
	},
});

export const getByDate = query({
	args: {
		mentraUserId: v.string(),
		date: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			return null;
		}

		const summary = await ctx.db
			.query("dailySummaries")
			.withIndex("by_user_date", (q) =>
				q.eq("userId", user._id).eq("date", args.date),
			)
			.first();

		if (!summary) {
			return null;
		}

		return {
			date: summary.date,
			summary: summary.summary,
			topics: summary.topics,
			sessionCount: summary.sessionCount,
		};
	},
});

export const upsertInternal = internalMutation({
	args: {
		userId: v.id("users"),
		date: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		sessionCount: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("dailySummaries")
			.withIndex("by_user_date", (q) =>
				q.eq("userId", args.userId).eq("date", args.date),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				topics: args.topics,
				sessionCount: args.sessionCount,
			});
			return existing._id;
		}

		return await ctx.db.insert("dailySummaries", args);
	},
});
