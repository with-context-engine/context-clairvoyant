import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// =============================================================================
// Public Mutations
// =============================================================================

export const increment = mutation({
	args: {
		mentraUserId: v.string(),
		router: v.string(),
		date: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_mentra_id", (q) => q.eq("mentraUserId", args.mentraUserId))
			.first();

		if (!user) {
			throw new Error(`User not found for mentraUserId: ${args.mentraUserId}`);
		}

		const date = args.date ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD

		const existing = await ctx.db
			.query("toolInvocations")
			.withIndex("by_user_router_date", (q) =>
				q.eq("userId", user._id).eq("router", args.router).eq("date", date),
			)
			.first();

		if (existing) {
			const newCount = existing.count + 1;
			await ctx.db.patch(existing._id, { count: newCount });
			return newCount;
		}

		await ctx.db.insert("toolInvocations", {
			userId: user._id,
			router: args.router,
			count: 1,
			date,
		});

		return 1;
	},
});

// =============================================================================
// Public Queries
// =============================================================================

export const getUserToolInvocations = query({
	args: {
		userId: v.id("users"),
		days: v.number(),
	},
	handler: async (ctx, args) => {
		const allowedDays = new Set([1, 7, 30]);
		if (!allowedDays.has(args.days)) {
			throw new Error(`Unsupported range: ${args.days}`);
		}

		const today = new Date();
		today.setUTCHours(0, 0, 0, 0);

		const start = new Date(today);
		start.setUTCDate(start.getUTCDate() - (args.days - 1));
		const startDate = start.toISOString().slice(0, 10);

		const docs = await ctx.db
			.query("toolInvocations")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();

		return docs
			.filter((doc) => doc.date >= startDate)
			.sort((a, b) => {
				const dateCompare = a.date.localeCompare(b.date);
				if (dateCompare !== 0) return dateCompare;
				return a.router.localeCompare(b.router);
			})
			.map((doc) => ({
				date: doc.date,
				router: doc.router,
				count: doc.count,
			}));
	},
});

