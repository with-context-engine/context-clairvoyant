import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const getMessages = query({
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

		const messages = await ctx.db
			.query("chatMessages")
			.withIndex("by_user_date", (q) =>
				q.eq("userId", user._id).eq("date", args.date),
			)
			.collect();

		return messages
			.sort(
				(a, b) =>
					new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
			)
			.map((m) => ({
				role: m.role,
				content: m.content,
				createdAt: m.createdAt,
			}));
	},
});

export const getSessionSummariesForDate = internalQuery({
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
				honchoSessionId: s.honchoSessionId,
				summary: s.summary,
				topics: s.topics,
				startedAt: s.startedAt,
				endedAt: s.endedAt,
			}));
	},
});

export const getMessagesInternal = internalQuery({
	args: {
		userId: v.id("users"),
		date: v.string(),
	},
	handler: async (ctx, { userId, date }) => {
		const messages = await ctx.db
			.query("chatMessages")
			.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
			.collect();

		return messages.sort(
			(a, b) =>
				new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
		);
	},
});

export const insertMessage = internalMutation({
	args: {
		userId: v.id("users"),
		dailySummaryId: v.optional(v.id("dailySummaries")),
		date: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		createdAt: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("chatMessages", args);
	},
});

export const getDailySummaryForDate = internalQuery({
	args: {
		userId: v.id("users"),
		date: v.string(),
	},
	handler: async (ctx, { userId, date }) => {
		return await ctx.db
			.query("dailySummaries")
			.withIndex("by_user_date", (q) => q.eq("userId", userId).eq("date", date))
			.first();
	},
});
