import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		mentraUserId: v.string(),
		mentraToken: v.optional(v.string()),
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
	}).index("by_mentra_id", ["mentraUserId"]),
	preferences: defineTable({
		userId: v.id("users"),
		weatherUnit: v.string(),
		defaultLocation: v.optional(v.string()),
	}).index("by_user", ["userId"]),
	toolInvocations: defineTable({
		userId: v.id("users"),
		router: v.string(),
		count: v.number(),
		date: v.string(),
	})
		.index("by_user", ["userId"])
		.index("by_user_router_date", ["userId", "router", "date"]),
	sessionSummaries: defineTable({
		userId: v.id("users"),
		mentraSessionId: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		startedAt: v.string(),
		endedAt: v.string(),
	})
		.index("by_user", ["userId"])
		.index("by_user_session", ["userId", "mentraSessionId"]),
	dailySummaries: defineTable({
		userId: v.id("users"),
		date: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		sessionCount: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_date", ["userId", "date"]),
});
