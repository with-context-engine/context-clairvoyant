import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const logConversation = mutation({
	args: {
		userId: v.id("users"),
		sessionId: v.string(),
		transcript: v.string(),
		route: v.string(),
		response: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (user?.optedOutOfTraining) {
			return null;
		}

		return await ctx.db.insert("conversationLogs", {
			userId: args.userId,
			sessionId: args.sessionId,
			transcript: args.transcript,
			route: args.route,
			response: args.response,
		});
	},
});

export const getBySession = query({
	args: {
		sessionId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("conversationLogs")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.order("desc")
			.collect();
	},
});

export const getByUser = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("conversationLogs")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.collect();
	},
});

export const updateResponse = mutation({
	args: {
		userId: v.id("users"),
		sessionId: v.string(),
		transcript: v.string(),
		response: v.string(),
	},
	handler: async (ctx, args) => {
		const log = await ctx.db
			.query("conversationLogs")
			.withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
			.filter((q) =>
				q.and(
					q.eq(q.field("userId"), args.userId),
					q.eq(q.field("transcript"), args.transcript),
				),
			)
			.order("desc")
			.first();

		if (log) {
			await ctx.db.patch(log._id, { response: args.response });
			return log._id;
		}
		return null;
	},
});
