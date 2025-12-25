import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const create = internalMutation({
	args: {
		mentraUserId: v.string(),
		emailId: v.string(),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const now = new Date().toISOString();
		await ctx.db.insert("emailNotes", {
			mentraUserId: args.mentraUserId,
			emailId: args.emailId,
			title: args.title,
			status: "queued",
			createdAt: now,
			updatedAt: now,
		});
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
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailNotes")
			.withIndex("by_mentra_user", (q) => q.eq("mentraUserId", args.mentraUserId))
			.order("desc")
			.first();
	},
});
