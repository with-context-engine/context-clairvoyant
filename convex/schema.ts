import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		mentraUserId: v.string(),
		mentraToken: v.optional(v.string()),
	}).index("by_mentra_id", ["mentraUserId"]),
	preferences: defineTable({
		userId: v.id("users"),
		weatherUnit: v.string(),
		defaultLocation: v.optional(v.string()),
	}).index("by_user", ["userId"]),
});
