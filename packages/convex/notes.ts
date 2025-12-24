"use node";

import { render } from "@react-email/render";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { SessionNoteEmail } from "./emails/SessionNote";
import { resend } from "./resendClient";

type SendNoteResult =
	| { success: true; emailId: string }
	| { success: false; reason: string };

export const sendNoteEmail = action({
	args: {
		mentraUserId: v.string(),
		title: v.string(),
		summary: v.string(),
		keyPoints: v.array(v.string()),
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

		try {
			const emailId = await resend.sendEmail(ctx, {
				from: "Clairvoyant <noreply@notes.clairvoyant.with-context.co>",
				to: user.email,
				subject: args.title,
				html,
			});

			await ctx.runMutation(internal.emailNotes.create, {
				mentraUserId: args.mentraUserId,
				emailId,
				title: args.title,
			});

			console.log(
				`[Notes] Email queued successfully to ${user.email} (id: ${emailId})`,
			);
			return { success: true, emailId };
		} catch (error) {
			console.error(`[Notes] Failed to send email:`, error);
			return { success: false, reason: "send_failed" };
		}
	},
});
