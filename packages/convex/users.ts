import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
} from "./_generated/server";

// =============================================================================
// Utilities
// =============================================================================

async function getByMentraIdInternal(
	ctx: QueryCtx | MutationCtx,
	mentraUserId: string,
) {
	return await ctx.db
		.query("users")
		.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", mentraUserId))
		.first();
}

// =============================================================================
// Public Queries - User Identity
// =============================================================================

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

export const getByMentraIdInternalQuery = internalQuery({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();
	},
});

export const getByIdInternal = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.userId);
	},
});

export const getEmail = query({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await getByMentraIdInternal(ctx, args.mentraUserId);
		if (!user) {
			throw new Error("User not found");
		}
		return user.email ?? null;
	},
});

// =============================================================================
// Public Queries - Preferences
// =============================================================================

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

// =============================================================================
// Public Mutations - User Identity
// =============================================================================

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

export const updateEmail = mutation({
	args: { mentraUserId: v.string(), email: v.string() },
	handler: async (ctx, args) => {
		const user = await getByMentraIdInternal(ctx, args.mentraUserId);
		if (!user) {
			throw new Error("User not found");
		}
		await ctx.db.patch(user._id, { email: args.email });
		return { success: true };
	},
});

// =============================================================================
// Public Mutations - Preferences
// =============================================================================

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

export const setCurrentLocation = mutation({
	args: {
		userId: v.id("users"),
		defaultLocation: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { userId, defaultLocation } = args;

		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				defaultLocation,
			});
			return existing._id;
		}

		// Create new preferences record if it doesn't exist
		return await ctx.db.insert("preferences", {
			userId,
			weatherUnit: "C",
			defaultLocation,
		});
	},
});

export const setCurrentLocationByMentraId = mutation({
	args: {
		mentraUserId: v.string(),
		defaultLocation: v.string(),
	},
	handler: async (ctx, args) => {
		const { mentraUserId, defaultLocation } = args;

		const user = await getByMentraIdInternal(ctx, mentraUserId);
		if (!user) {
			throw new Error(`User not found for mentraUserId: ${mentraUserId}`);
		}

		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				defaultLocation,
			});
			return existing._id;
		}

		// Create new preferences record if it doesn't exist
		return await ctx.db.insert("preferences", {
			userId: user._id,
			weatherUnit: "C",
			defaultLocation,
		});
	},
});

export const updatePrefixPriorities = mutation({
	args: {
		userId: v.id("users"),
		prefixPriorities: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				prefixPriorities: args.prefixPriorities,
			});
			return existing._id;
		}
		return await ctx.db.insert("preferences", {
			userId: args.userId,
			weatherUnit: "C",
			prefixPriorities: args.prefixPriorities,
		});
	},
});

export const updateMessageGapSpeed = mutation({
	args: {
		userId: v.id("users"),
		messageGapSpeed: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				messageGapSpeed: args.messageGapSpeed,
			});
			return existing._id;
		}
		return await ctx.db.insert("preferences", {
			userId: args.userId,
			weatherUnit: "C",
			messageGapSpeed: args.messageGapSpeed,
		});
	},
});

// =============================================================================
// Internal Mutations
// =============================================================================

export const storeBillingInfo = internalMutation({
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

export const updateDefaultLocation = internalMutation({
	args: {
		userId: v.id("users"),
		defaultLocation: v.string(),
	},
	handler: async (ctx, args) => {
		const { userId, defaultLocation } = args;

		const user = await ctx.db.get(userId);
		if (!user) {
			throw new Error(`User not found: ${userId}`);
		}

		// Get existing preferences or create new ones
		const existing = await ctx.db
			.query("preferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, {
				defaultLocation,
			});
			return existing._id;
		}

		// Create new preferences record if it doesn't exist
		return await ctx.db.insert("preferences", {
			userId,
			weatherUnit: "C",
			defaultLocation,
		});
	},
});
