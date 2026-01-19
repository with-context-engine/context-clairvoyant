import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const create = internalMutation({
	args: {
		userId: v.id("users"),
		emailId: v.string(),
		title: v.string(),
		subject: v.string(),
		honchoSessionId: v.optional(v.string()),
		sessionSummaryId: v.optional(v.id("sessionSummaries")),
	},
	handler: async (ctx, args) => {
		const now = new Date().toISOString();
		const id = await ctx.db.insert("emailNotes", {
			userId: args.userId,
			emailId: args.emailId,
			title: args.title,
			subject: args.subject,
			honchoSessionId: args.honchoSessionId,
			sessionSummaryId: args.sessionSummaryId,
			status: "queued",
			createdAt: now,
			updatedAt: now,
		});
		return id;
	},
});

export const getByEmailId = query({
	args: { emailId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailNotes")
			.withIndex("by_email_id", (q) => q.eq("emailId", args.emailId))
			.first();
	},
});

export const getLatestForUser = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailNotes")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.order("desc")
			.first();
	},
});

export const getByIdInternal = internalQuery({
	args: { emailNoteId: v.id("emailNotes") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.emailNoteId);
	},
});
