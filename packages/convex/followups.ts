import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";

async function getUserByMentraId(ctx: { db: any }, mentraUserId: string) {
	return await ctx.db
		.query("users")
		.withIndex("by_mentra_id", (q: any) => q.eq("mentraUserId", mentraUserId))
		.first();
}

export const create = mutation({
	args: {
		mentraUserId: v.string(),
		sessionId: v.string(),
		topic: v.string(),
		summary: v.string(),
		sourceMessages: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await getUserByMentraId(ctx, args.mentraUserId);
		if (!user) {
			throw new Error(`User not found for mentraUserId: ${args.mentraUserId}`);
		}

		const id = await ctx.db.insert("followups", {
			userId: user._id,
			sessionId: args.sessionId,
			topic: args.topic,
			summary: args.summary,
			sourceMessages: args.sourceMessages,
			completed: false,
			dismissed: false,
		});
		return id;
	},
});

export const getByUser = query({
	args: {
		mentraUserId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await getUserByMentraId(ctx, args.mentraUserId);
		if (!user) {
			return [];
		}

		const limit = args.limit ?? 20;
		return await ctx.db
			.query("followups")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.order("desc")
			.take(limit);
	},
});

export const getPendingByUser = query({
	args: {
		mentraUserId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await getUserByMentraId(ctx, args.mentraUserId);
		if (!user) {
			return [];
		}

		const limit = args.limit ?? 20;
		return await ctx.db
			.query("followups")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.filter((q) =>
				q.and(
					q.eq(q.field("completed"), false),
					q.eq(q.field("dismissed"), false),
				),
			)
			.order("desc")
			.take(limit);
	},
});

export const getById = query({
	args: {
		id: v.id("followups"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

export const getByIdInternal = internalQuery({
	args: {
		followupId: v.id("followups"),
	},
	handler: async (ctx, { followupId }) => {
		return await ctx.db.get(followupId);
	},
});

export const markCompleted = mutation({
	args: {
		id: v.id("followups"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, { completed: true });
	},
});

export const markDismissed = mutation({
	args: {
		id: v.id("followups"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, { dismissed: true });
	},
});

export const deleteFollowup = mutation({
	args: {
		id: v.id("followups"),
	},
	handler: async (ctx, args) => {
		await ctx.db.delete(args.id);
	},
});
