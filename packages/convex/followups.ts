import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, mutation, query } from "./_generated/server";

export const create = mutation({
	args: {
		userId: v.id("users"),
		sessionId: v.string(),
		topic: v.string(),
		summary: v.string(),
		sourceMessages: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const now = new Date().toISOString();
		const id = await ctx.db.insert("followups", {
			userId: args.userId,
			sessionId: args.sessionId,
			topic: args.topic,
			summary: args.summary,
			sourceMessages: args.sourceMessages,
			status: "pending",
			createdAt: now,
		});
		return id;
	},
});

export const getByUser = query({
	args: {
		userId: v.id("users"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20;
		return await ctx.db
			.query("followups")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.take(limit);
	},
});

export const getPendingByUser = query({
	args: {
		userId: v.id("users"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20;
		return await ctx.db
			.query("followups")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.filter((q) => q.eq(q.field("status"), "pending"))
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

export const updateStatus = mutation({
	args: {
		id: v.id("followups"),
		status: v.union(
			v.literal("pending"),
			v.literal("completed"),
			v.literal("dismissed"),
		),
		completedAt: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, {
			status: args.status,
			completedAt: args.completedAt,
		});
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
