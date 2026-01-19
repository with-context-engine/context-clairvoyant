import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

export const upsert = mutation({
	args: {
		mentraUserId: v.string(),
		honchoSessionId: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
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
			.withIndex("by_honcho_session", (q) =>
				q.eq("honchoSessionId", args.honchoSessionId),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				topics: args.topics,
			});
			return existing._id;
		}

		return await ctx.db.insert("sessionSummaries", {
			userId: user._id,
			honchoSessionId: args.honchoSessionId,
			summary: args.summary,
			topics: args.topics,
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
			.filter((s) => new Date(s._creationTime).toISOString().startsWith(args.date))
			.map((s) => ({
				honchoSessionId: s.honchoSessionId,
				summary: s.summary,
				topics: s.topics,
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
			_creationTime: s._creationTime,
			honchoSessionId: s.honchoSessionId,
			summary: s.summary,
			topics: s.topics,
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
			.filter((s) => new Date(s._creationTime).toISOString().startsWith(date))
			.map((s) => ({
				_creationTime: s._creationTime,
				honchoSessionId: s.honchoSessionId,
				summary: s.summary,
				topics: s.topics,
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
			.filter((s) => new Date(s._creationTime).toISOString().startsWith(date))
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
			_creationTime: s._creationTime,
			honchoSessionId: s.honchoSessionId,
			summary: s.summary,
			topics: s.topics,
		}));
	},
});

export const getByIdInternal = internalQuery({
	args: {
		sessionSummaryId: v.id("sessionSummaries"),
	},
	handler: async (ctx, { sessionSummaryId }) => {
		return await ctx.db.get(sessionSummaryId);
	},
});

export const updateInternal = internalMutation({
	args: {
		sessionSummaryId: v.id("sessionSummaries"),
		summary: v.string(),
		topics: v.array(v.string()),
	},
	handler: async (ctx, { sessionSummaryId, summary, topics }) => {
		await ctx.db.patch(sessionSummaryId, {
			summary,
			topics,
		});
		return sessionSummaryId;
	},
});

export const getByHonchoSessionIdInternal = internalQuery({
	args: {
		honchoSessionId: v.string(),
	},
	handler: async (ctx, { honchoSessionId }) => {
		return await ctx.db
			.query("sessionSummaries")
			.withIndex("by_honcho_session", (q) =>
				q.eq("honchoSessionId", honchoSessionId),
			)
			.first();
	},
});

export const getLatestForUser = query({
	args: {
		mentraUserId: v.string(),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			return null;
		}

		const latestSummary = await ctx.db
			.query("sessionSummaries")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.order("desc")
			.first();

		return latestSummary;
	},
});
