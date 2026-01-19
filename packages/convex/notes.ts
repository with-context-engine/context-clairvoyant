"use node";

import { render } from "@react-email/render";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { SessionNoteEmail } from "./emails/SessionNote";
import { resend } from "./resendClient";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "notes.example.com";

function generateMessageId(): string {
	return crypto.randomUUID();
}

type SendNoteResult =
	| { success: true; emailId: string }
	| { success: false; reason: string };

export const sendNoteEmail = action({
	args: {
		mentraUserId: v.string(),
		title: v.string(),
		summary: v.string(),
		keyPoints: v.array(v.string()),
		sessionSummaryId: v.optional(v.id("sessionSummaries")),
	},
	handler: async (ctx, args): Promise<SendNoteResult> => {
		const user = await ctx.runQuery(api.users.getByMentraId, {
			mentraUserId: args.mentraUserId,
		});

		if (!user) {
			console.warn(
				`[Notes] User not found for mentraUserId: ${args.mentraUserId}`,
			);
			return { success: false, reason: "user_not_found" };
		}

		if (!user.email) {
			console.warn(
				`[Notes] No email configured for user: ${args.mentraUserId}`,
			);
			return { success: false, reason: "no_email_configured" };
		}

		const sessionDate = new Date().toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});

		const html = await render(
			SessionNoteEmail({
				title: args.title,
				summary: args.summary,
				keyPoints: args.keyPoints,
				sessionDate,
			}),
		);

		const messageId = generateMessageId();

		try {
			const emailNoteId = await ctx.runMutation(internal.emailNotes.create, {
				userId: user._id,
				emailId: messageId,
				title: args.title,
				subject: args.title,
				sessionSummaryId: args.sessionSummaryId,
			});

			const replyToAddress = `chat+${emailNoteId}@${EMAIL_DOMAIN}`;

			const resendEmailId = await resend.sendEmail(ctx, {
				from: `Clairvoyant <noreply@${EMAIL_DOMAIN}>`,
				to: user.email,
				subject: args.title,
				html,
				replyTo: [replyToAddress],
				headers: [{ name: "Message-ID", value: messageId }],
			});

			const textContent = `${args.summary}\n\nKey Points:\n${args.keyPoints.map((p) => `• ${p}`).join("\n")}`;

			await ctx.runMutation(internal.emailThreadMessages.create, {
				emailNoteId,
				messageId,
				direction: "outbound",
				resendEmailId,
				textContent,
			});

			console.log(
				`[Notes] Email queued successfully to ${user.email} (noteId: ${emailNoteId}, resendId: ${resendEmailId})`,
			);
			return { success: true, emailId: resendEmailId };
		} catch (error) {
			console.error(`[Notes] Failed to send email:`, error);
			return { success: false, reason: "send_failed" };
		}
	},
});
