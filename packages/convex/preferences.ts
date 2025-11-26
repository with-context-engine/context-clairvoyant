import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getPreferences = query({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const prefs = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();

		if (!prefs) {
			return {
				userId: args.userId,
				weatherUnit: "C" as const,
				defaultLocation: undefined,
			};
		}

		return prefs;
	},
});

export const getPreferencesByMentraId = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			throw new Error("User not found");
		}

		const prefs = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.first();

		if (!prefs) {
			return {
				userId: user._id,
				weatherUnit: "C" as const,
				defaultLocation: undefined,
			};
		}

		return prefs;
	},
});

export const updatePreferences = mutation({
	args: {
		userId: v.id("users"),
		weatherUnit: v.string(),
		defaultLocation: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				weatherUnit: args.weatherUnit,
				defaultLocation: args.defaultLocation,
			});
			return existing._id;
		}

		return await ctx.db.insert("preferences", {
			userId: args.userId,
			weatherUnit: args.weatherUnit,
			defaultLocation: args.defaultLocation,
		});
	},
});
