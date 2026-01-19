import { v } from "convex/values";
import {
	internalMutation,
	internalQuery,
	query,
} from "./_generated/server";

export const getMessages = query({
	args: {
		followupId: v.id("followups"),
	},
	handler: async (ctx, args) => {
		const messages = await ctx.db
			.query("followupChatMessages")
			.withIndex("by_followup", (q) => q.eq("followupId", args.followupId))
			.collect();

		return messages
			.sort((a, b) => a._creationTime - b._creationTime)
			.map((m) => ({
				role: m.role,
				content: m.content,
				createdAt: new Date(m._creationTime).toISOString(),
			}));
	},
});

export const getMessagesInternal = internalQuery({
	args: {
		followupId: v.id("followups"),
	},
	handler: async (ctx, { followupId }) => {
		const messages = await ctx.db
			.query("followupChatMessages")
			.withIndex("by_followup", (q) => q.eq("followupId", followupId))
			.collect();

		return messages.sort((a, b) => a._creationTime - b._creationTime);
	},
});

export const insertMessage = internalMutation({
	args: {
		followupId: v.id("followups"),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("followupChatMessages", args);
	},
});
