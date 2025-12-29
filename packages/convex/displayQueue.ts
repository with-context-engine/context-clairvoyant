import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const enqueue = mutation({
	args: {
		mentraUserId: v.string(),
		sessionId: v.string(),
		message: v.string(),
		prefix: v.string(),
		priority: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const now = new Date().toISOString();
		const id = await ctx.db.insert("displayQueue", {
			mentraUserId: args.mentraUserId,
			sessionId: args.sessionId,
			message: args.message,
			prefix: args.prefix,
			status: "queued",
			priority: args.priority ?? 3,
			createdAt: now,
		});
		return id;
	},
});

export const markDisplayed = mutation({
	args: {
		id: v.id("displayQueue"),
	},
	handler: async (ctx, args) => {
		const now = new Date().toISOString();
		await ctx.db.patch(args.id, {
			status: "displayed",
			displayedAt: now,
		});
	},
});

export const markCancelled = mutation({
	args: {
		id: v.id("displayQueue"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.id, {
			status: "cancelled",
		});
	},
});

export const getQueuedBySession = query({
	args: {
		sessionId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("displayQueue")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.filter((q) => q.eq(q.field("status"), "queued"))
			.collect();
	},
});

export const getRecentByUser = query({
	args: {
		mentraUserId: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20;
		return await ctx.db
			.query("displayQueue")
			.withIndex("by_mentra_user", (q) =>
				q.eq("mentraUserId", args.mentraUserId),
			)
			.order("desc")
			.take(limit);
	},
});

export const clearSessionQueue = mutation({
	args: {
		sessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const queued = await ctx.db
			.query("displayQueue")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.filter((q) => q.eq(q.field("status"), "queued"))
			.collect();

		for (const msg of queued) {
			await ctx.db.patch(msg._id, {
				status: "cancelled",
			});
		}

		return queued.length;
	},
});

export const deleteSessionMessages = mutation({
	args: {
		sessionId: v.string(),
	},
	handler: async (ctx, args) => {
		const messages = await ctx.db
			.query("displayQueue")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.collect();

		for (const msg of messages) {
			await ctx.db.delete(msg._id);
		}

		return messages.length;
	},
});
