import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

export const getOrCreate = mutation({
	args: { mentraUserId: v.string(), mentraToken: v.string() },
	handler: async (ctx, args) => {
		const existing = await getByMentraIdInternal(ctx, args.mentraUserId);
		if (existing) {
			return existing._id;
		}
		const userId = await ctx.db.insert("users", {
			mentraUserId: args.mentraUserId,
			mentraToken: args.mentraToken,
		});

		await ctx.db.insert("preferences", {
			userId,
			weatherUnit: "C",
		});

		return userId;
	},
});

async function getByMentraIdInternal(
	ctx: QueryCtx | MutationCtx,
	mentraUserId: string,
) {
	return await ctx.db
		.query("users")
		.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", mentraUserId))
		.first();
}

export const getById = query({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db.get(args.userId);
		if (!user) {
			throw new Error("User not found");
		}
		return {
			userId: user._id,
			userEmail: user.mentraUserId,
		};
	},
});

export const getCurrentUser = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}
		const user = await ctx.db.get(identity.subject as Id<"users">);
		if (!user) {
			throw new Error(
				`User not found for identity subject: ${identity.subject}`,
			);
		}
		return {
			_id: user._id,
			email: user.mentraUserId,
		};
	},
});

export const getByMentraId = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		return await getByMentraIdInternal(ctx, args.mentraUserId);
	},
});

export const storeBillingInfo = mutation({
	args: {
		userId: v.id("users"),
		billingName: v.optional(v.string()),
		billingAddress: v.optional(
			v.object({
				city: v.string(),
				country: v.string(),
				line1: v.string(),
				line2: v.optional(v.string()),
				postalCode: v.string(),
				state: v.string(),
			}),
		),
	},
	handler: async (ctx, args) => {
		const { userId, billingName, billingAddress } = args;

		const user = await ctx.db.get(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		await ctx.db.patch(userId, {
			...(billingName !== undefined && { billingName }),
			...(billingAddress !== undefined && { billingAddress }),
		});

		return { success: true };
	},
});
