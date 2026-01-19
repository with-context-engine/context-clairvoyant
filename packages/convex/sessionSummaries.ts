import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

export const upsert = mutation({
	args: {
		mentraUserId: v.string(),
		honchoSessionId: v.string(),
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
			.withIndex("by_honcho_session", (q) =>
				q.eq("honchoSessionId", args.honchoSessionId),
			)
			.first();

		let sessionSummaryId: Id<"sessionSummaries">;

		if (existing) {
			await ctx.db.patch(existing._id, {
				summary: args.summary,
				topics: args.topics,
				endedAt: args.endedAt,
			});
			sessionSummaryId = existing._id;
		} else {
			sessionSummaryId = await ctx.db.insert("sessionSummaries", {
				userId: user._id,
				honchoSessionId: args.honchoSessionId,
				summary: args.summary,
				topics: args.topics,
				startedAt: args.startedAt,
				endedAt: args.endedAt,
			});
		}

		const emailNotesToLink = await ctx.db
			.query("emailNotes")
			.withIndex("by_honcho_session", (q) =>
				q.eq("honchoSessionId", args.honchoSessionId),
			)
			.collect();

		for (const note of emailNotesToLink) {
			if (!note.sessionSummaryId) {
				await ctx.db.patch(note._id, {
					sessionSummaryId,
					updatedAt: new Date().toISOString(),
				});
			}
		}

		return sessionSummaryId;
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
				honchoSessionId: s.honchoSessionId,
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
			honchoSessionId: s.honchoSessionId,
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
				honchoSessionId: s.honchoSessionId,
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
			honchoSessionId: s.honchoSessionId,
			summary: s.summary,
			topics: s.topics,
			startedAt: s.startedAt,
			endedAt: s.endedAt,
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
