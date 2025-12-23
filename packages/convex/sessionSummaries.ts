import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";

export const upsert = mutation({
	args: {
		mentraUserId: v.string(),
		mentraSessionId: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		startedAt: v.string(),
		endedAt: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			throw new Error(`User not found for mentraUserId: ${args.mentraUserId}`);
		}

		const existing = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user_session", (q) =>
				q.eq("userId", user._id).eq("mentraSessionId", args.mentraSessionId),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				topics: args.topics,
				endedAt: args.endedAt,
			});
			return existing._id;
		}

		return await ctx.db.insert("sessionSummaries", {
			userId: user._id,
			mentraSessionId: args.mentraSessionId,
			summary: args.summary,
			topics: args.topics,
			startedAt: args.startedAt,
			endedAt: args.endedAt,
		});
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
			return [];
		}

		const summaries = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.collect();

		return summaries
			.filter((s) => s.startedAt.startsWith(args.date))
			.map((s) => ({
				mentraSessionId: s.mentraSessionId,
				summary: s.summary,
				topics: s.topics,
				startedAt: s.startedAt,
				endedAt: s.endedAt,
			}));
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

		const limit = args.limit ?? 10;

		const summaries = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(limit);

		return summaries.map((s) => ({
			mentraSessionId: s.mentraSessionId,
			summary: s.summary,
			topics: s.topics,
			startedAt: s.startedAt,
			endedAt: s.endedAt,
		}));
	},
});

export const getByDateInternal = internalQuery({
	args: {
		userId: v.id("users"),
		date: v.string(),
	},
	handler: async (ctx, { userId, date }) => {
		const summaries = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		return summaries
			.filter((s) => s.startedAt.startsWith(date))
			.map((s) => ({
				mentraSessionId: s.mentraSessionId,
				summary: s.summary,
				topics: s.topics,
				startedAt: s.startedAt,
				endedAt: s.endedAt,
			}));
	},
});

export const getUsersWithSessionsOnDate = internalQuery({
	args: {
		date: v.string(),
	},
	handler: async (ctx, { date }) => {
		const allSummaries = await ctx.db.query("sessionSummaries").collect();

		const usersOnDate = allSummaries
			.filter((s) => s.startedAt.startsWith(date))
			.map((s) => s.userId);

		return [...new Set(usersOnDate)];
	},
});

export const getAllForUserInternal = internalQuery({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, { userId }) => {
		const summaries = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.collect();

		return summaries.map((s) => ({
			mentraSessionId: s.mentraSessionId,
			summary: s.summary,
			topics: s.topics,
			startedAt: s.startedAt,
			endedAt: s.endedAt,
		}));
	},
});
