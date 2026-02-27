import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const FREE_EMAIL_THREAD_LIMIT = 10;

function currentPeriodKey(): string {
	const now = new Date();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${now.getUTCFullYear()}-${month}`;
}

export const getEmailThreadStatus = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			return null;
		}

		const periodKey = currentPeriodKey();
		const usage = await ctx.db
			.query("emailThreadUsage")
			.withIndex("by_user_period", (q) =>
				q.eq("userId", user._id).eq("periodKey", periodKey),
			)
			.first();

		const used = usage?.outboundCount ?? 0;
		const limit = FREE_EMAIL_THREAD_LIMIT;

		return {
			periodKey,
			paidEmailThreads: user.paidEmailThreads ?? false,
			used,
			limit,
			remaining: Math.max(0, limit - used),
		};
	},
});

export const getUsageByUserPeriod = internalQuery({
	args: {
		userId: v.id("users"),
		periodKey: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailThreadUsage")
			.withIndex("by_user_period", (q) =>
				q.eq("userId", args.userId).eq("periodKey", args.periodKey),
			)
			.first();
	},
});

export const incrementOutboundUsage = internalMutation({
	args: {
		userId: v.id("users"),
		periodKey: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const periodKey = args.periodKey ?? currentPeriodKey();
		const existing = await ctx.db
			.query("emailThreadUsage")
			.withIndex("by_user_period", (q) =>
				q.eq("userId", args.userId).eq("periodKey", periodKey),
			)
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				outboundCount: existing.outboundCount + 1,
			});
			return existing._id;
		}

		return await ctx.db.insert("emailThreadUsage", {
			userId: args.userId,
			periodKey,
			outboundCount: 1,
		});
	},
});

export const markPaywallSent = internalMutation({
	args: {
		userId: v.id("users"),
		periodKey: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("emailThreadUsage")
			.withIndex("by_user_period", (q) =>
				q.eq("userId", args.userId).eq("periodKey", args.periodKey),
			)
			.first();

		const timestamp = new Date().toISOString();
		if (existing) {
			await ctx.db.patch(existing._id, {
				paywallEmailSentAt: timestamp,
			});
			return existing._id;
		}

		return await ctx.db.insert("emailThreadUsage", {
			userId: args.userId,
			periodKey: args.periodKey,
			outboundCount: FREE_EMAIL_THREAD_LIMIT,
			paywallEmailSentAt: timestamp,
		});
	},
});
