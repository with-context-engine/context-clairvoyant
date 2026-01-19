import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

export const create = internalMutation({
	args: {
		emailNoteId: v.id("emailNotes"),
		messageId: v.string(),
		direction: v.union(v.literal("outbound"), v.literal("inbound")),
		resendEmailId: v.optional(v.string()),
		textContent: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		console.log("[EmailThread] Creating thread message:", {
			emailNoteId: args.emailNoteId,
			direction: args.direction,
			messageId: `${args.messageId.substring(0, 30)}...`,
			hasResendId: !!args.resendEmailId,
			textLength: args.textContent?.length ?? 0,
		});
		const id = await ctx.db.insert("emailThreadMessages", {
			emailNoteId: args.emailNoteId,
			messageId: args.messageId,
			direction: args.direction,
			resendEmailId: args.resendEmailId,
			textContent: args.textContent,
		});
		console.log(`[EmailThread] ✓ Created message ${id}`);
		return id;
	},
});

export const createInbound = internalMutation({
	args: {
		emailNoteId: v.string(),
		messageId: v.string(),
		textContent: v.string(),
		from: v.string(),
	},
	handler: async (ctx, args) => {
		console.log("[EmailThread] createInbound called:", {
			emailNoteId: args.emailNoteId,
			from: args.from,
			messageId: `${args.messageId.substring(0, 30)}...`,
			textLength: args.textContent.length,
		});

		const emailNote = await ctx.db
			.query("emailNotes")
			.filter((q) => q.eq(q.field("_id"), args.emailNoteId))
			.first();

		if (!emailNote) {
			console.warn(
				`[EmailThread] ✗ No emailNote found for id: ${args.emailNoteId}`,
			);
			return null;
		}
		console.log(
			`[EmailThread] ✓ Found emailNote: ${emailNote._id}, subject: ${emailNote.subject}`,
		);

		const id = await ctx.db.insert("emailThreadMessages", {
			emailNoteId: emailNote._id,
			messageId: args.messageId,
			direction: "inbound",
			textContent: args.textContent,
		});

		console.log(
			`[EmailThread] ✓ Stored inbound message ${id} for note ${args.emailNoteId} from ${args.from}`,
		);

		return {
			threadMessageId: id,
			emailNoteId: emailNote._id,
		};
	},
});

export const getByEmailNote = query({
	args: { emailNoteId: v.id("emailNotes") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailThreadMessages")
			.withIndex("by_email_note", (q) => q.eq("emailNoteId", args.emailNoteId))
			.order("asc")
			.collect();
	},
});

export const getByEmailNoteInternal = internalQuery({
	args: { emailNoteId: v.id("emailNotes") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("emailThreadMessages")
			.withIndex("by_email_note", (q) => q.eq("emailNoteId", args.emailNoteId))
			.order("asc")
			.collect();
	},
});
