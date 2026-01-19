import { vOnEmailEventArgs } from "@convex-dev/resend";
import { internalMutation } from "./_generated/server";

export const handleEmailEvent = internalMutation({
	args: vOnEmailEventArgs,
	handler: async (ctx, args) => {
		const { id, event } = args;

		console.log("[Email Event]", {
			emailId: id,
			eventType: event.type,
			createdAt: event.created_at,
		});

		const threadMessage = await ctx.db
			.query("emailThreadMessages")
			.withIndex("by_resend_email_id", (q) => q.eq("resendEmailId", id))
			.first();

		if (!threadMessage) {
			console.warn(`[Email Event] No threadMessage found for resendEmailId: ${id}`);
			return;
		}

		const existingNote = await ctx.db.get(threadMessage.emailNoteId);

		if (!existingNote) {
			console.warn(`[Email Event] No emailNote found for emailNoteId: ${threadMessage.emailNoteId}`);
			return;
		}

		let newStatus: "queued" | "sent" | "delivered" | "bounced" | "complained" =
			existingNote.status;

		switch (event.type) {
			case "email.sent":
				newStatus = "sent";
				break;
			case "email.delivered":
				newStatus = "delivered";
				break;
			case "email.bounced":
				newStatus = "bounced";
				break;
			case "email.complained":
				newStatus = "complained";
				break;
			default:
				console.log(`[Email Event] Unhandled event type: ${event.type}`);
				return;
		}

		await ctx.db.patch(existingNote._id, {
			status: newStatus,
			updatedAt: new Date().toISOString(),
		});

		console.log(
			`[Email Event] Updated emailNote ${id} status to: ${newStatus}`,
		);
	},
});
