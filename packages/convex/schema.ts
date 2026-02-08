import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		mentraUserId: v.string(),
		mentraToken: v.optional(v.string()),
		email: v.optional(v.string()),
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
		prefixPriorities: v.optional(v.array(v.string())),
		messageGapSpeed: v.optional(v.string()),
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
		honchoSessionId: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		startedAt: v.string(),
		endedAt: v.string(),
	})
		.index("by_user", ["userId"])
		.index("by_honcho_session", ["honchoSessionId"]),
	dailySummaries: defineTable({
		userId: v.id("users"),
		date: v.string(),
		summary: v.string(),
		topics: v.array(v.string()),
		sessionCount: v.number(),
	})
		.index("by_user", ["userId"])
		.index("by_user_date", ["userId", "date"]),
	honchoSessions: defineTable({
		userId: v.id("users"),
		mentraSessionId: v.string(),
		honchoSessionId: v.string(),
		createdAt: v.string(),
	})
		.index("by_user", ["userId"])
		.index("by_mentra_session", ["mentraSessionId"])
		.index("by_honcho_session", ["honchoSessionId"]),
	emailNotes: defineTable({
		userId: v.id("users"),
		emailId: v.string(),
		title: v.string(),
		subject: v.string(),
		honchoSessionId: v.optional(v.string()),
		sessionSummaryId: v.optional(v.id("sessionSummaries")),
		status: v.union(
			v.literal("queued"),
			v.literal("sent"),
			v.literal("delivered"),
			v.literal("bounced"),
			v.literal("complained"),
		),
		createdAt: v.string(),
		updatedAt: v.string(),
	})
		.index("by_user", ["userId"])
		.index("by_email_id", ["emailId"])
		.index("by_honcho_session", ["honchoSessionId"]),
	emailThreadMessages: defineTable({
		emailNoteId: v.id("emailNotes"),
		messageId: v.string(),
		direction: v.union(v.literal("outbound"), v.literal("inbound")),
		resendEmailId: v.optional(v.string()),
		textContent: v.optional(v.string()),
		createdAt: v.string(),
	})
		.index("by_email_note", ["emailNoteId"])
		.index("by_resend_email_id", ["resendEmailId"]),
	chatMessages: defineTable({
		userId: v.id("users"),
		dailySummaryId: v.optional(v.id("dailySummaries")),
		date: v.string(),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		createdAt: v.string(),
	})
		.index("by_user_date", ["userId", "date"])
		.index("by_daily_summary", ["dailySummaryId"]),
	displayQueue: defineTable({
		userId: v.id("users"),
		sessionId: v.string(),
		message: v.string(),
		prefix: v.string(),
		status: v.union(
			v.literal("queued"),
			v.literal("displayed"),
			v.literal("cancelled"),
		),
		priority: v.number(),
		createdAt: v.string(),
		displayedAt: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_session", ["sessionId"])
		.index("by_status", ["status"]),
	followups: defineTable({
		userId: v.id("users"),
		sessionId: v.string(),
		topic: v.string(),
		summary: v.string(),
		sourceMessages: v.array(v.string()),
		status: v.union(
			v.literal("pending"),
			v.literal("completed"),
			v.literal("dismissed"),
		),
		createdAt: v.string(),
		completedAt: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_status", ["status"]),
	followupChatMessages: defineTable({
		followupId: v.id("followups"),
		role: v.union(v.literal("user"), v.literal("assistant")),
		content: v.string(),
		createdAt: v.string(),
	}).index("by_followup", ["followupId"]),
	conversationLogs: defineTable({
		userId: v.id("users"),
		sessionId: v.string(),
		transcript: v.string(),
		route: v.string(),
		response: v.optional(v.string()),
	})
		.index("by_user", ["userId"])
		.index("by_session", ["sessionId"])
		.index("by_route", ["route"]),
});
