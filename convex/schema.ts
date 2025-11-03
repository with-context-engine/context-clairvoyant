import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		mentraUserId: v.string(),
	}).index("by_mentra_id", ["mentraUserId"]),
	subscriptions: defineTable({
		userId: v.id("users"),
		tier: v.string(),
		status: v.string(),
		polarSubscriptionId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
	}).index("by_user", ["userId"]),
});
