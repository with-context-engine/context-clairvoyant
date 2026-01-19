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
