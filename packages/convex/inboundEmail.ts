"use node";

import { v } from "convex/values";
import { Webhook } from "svix";
import { z } from "zod";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

interface InboundEmailEvent {
	type: "email.received";
	created_at: string;
	data: {
		email_id: string;
		created_at: string;
		from: string;
		to: string[];
		cc: string[];
		bcc: string[];
		subject: string;
		message_id: string;
		attachments: Array<{
			id: string;
			filename: string;
			content_type: string;
			content_disposition: string;
			content_id?: string;
		}>;
	};
}

const emailContentSchema = z.object({
	object: z.literal("email"),
	id: z.string(),
	from: z.string(),
	to: z.array(z.string()),
	created_at: z.string(),
	subject: z.string(),
	html: z.string(),
	text: z.string(),
});

function parseEmailNoteIdFromAddress(toAddresses: string[]): string | null {
	for (const addr of toAddresses) {
		const match = addr.match(/chat\+([a-z0-9]+)@/i);
		if (match?.[1]) {
			return match[1];
		}
	}
	return null;
}

export const processInboundWebhook = internalAction({
	args: {
		payload: v.string(),
		svixId: v.string(),
		svixTimestamp: v.string(),
		svixSignature: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const startTime = Date.now();
		console.log(
			"[Inbound Email] ========== START processInboundWebhook ==========",
		);
		console.log("[Inbound Email] Received webhook with svixId:", args.svixId);

		const webhookSecret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
		if (!webhookSecret) {
			console.error(
				"[Inbound Email] FATAL: Missing RESEND_INBOUND_WEBHOOK_SECRET env var",
			);
			return { success: false, error: "server_config" };
		}
		console.log("[Inbound Email] ✓ Webhook secret configured");

		let event: InboundEmailEvent;
		try {
			const wh = new Webhook(webhookSecret);
			event = wh.verify(args.payload, {
				"svix-id": args.svixId,
				"svix-timestamp": args.svixTimestamp,
				"svix-signature": args.svixSignature,
			}) as InboundEmailEvent;
			console.log("[Inbound Email] ✓ Svix signature verified");
		} catch (err) {
			console.error("[Inbound Email] ✗ Signature verification failed:", err);
			return { success: false, error: "invalid_signature" };
		}

		if (event.type !== "email.received") {
			console.log(
				`[Inbound Email] Ignoring non-email event type: ${event.type}`,
			);
			return { success: true };
		}

		const { email_id, from, to, subject, message_id } = event.data;

		console.log("[Inbound Email] Parsed event data:", {
			emailId: email_id,
			from,
			to,
			subject,
			messageId: message_id,
			createdAt: event.created_at,
		});

		const emailNoteId = parseEmailNoteIdFromAddress(to);
		if (!emailNoteId) {
			console.warn(
				`[Inbound Email] ✗ Could not parse emailNoteId from to addresses: ${to.join(", ")}`,
			);
			console.log(
				"[Inbound Email] Expected format: chat+{emailNoteId}@notes.clairvoyant.with-context.co",
			);
			return { success: true };
		}
		console.log(`[Inbound Email] ✓ Parsed emailNoteId: ${emailNoteId}`);

		const resendApiKey = process.env.RESEND_API_KEY;
		if (!resendApiKey) {
			console.error("[Inbound Email] FATAL: Missing RESEND_API_KEY env var");
			return { success: false, error: "server_config" };
		}

		console.log(
			`[Inbound Email] Fetching email body from Resend API for email_id: ${email_id}`,
		);
		const fetchStartTime = Date.now();
		const response = await fetch(
			`https://api.resend.com/emails/receiving/${email_id}`,
			{
				headers: {
					Authorization: `Bearer ${resendApiKey}`,
				},
			},
		);

		if (!response.ok) {
			console.error(
				`[Inbound Email] ✗ Resend API fetch failed: ${response.status} ${response.statusText}`,
			);
			return { success: false, error: "fetch_failed" };
		}
		console.log(
			`[Inbound Email] ✓ Resend API responded in ${Date.now() - fetchStartTime}ms`,
		);

		const emailContent = emailContentSchema.parse(await response.json());
		const textContent = emailContent.text || "";

		console.log("[Inbound Email] Email content retrieved:", {
			emailNoteId,
			from,
			subject,
			textLength: textContent.length,
			hasHtml: !!emailContent.html,
			textPreview:
				textContent.substring(0, 100) + (textContent.length > 100 ? "..." : ""),
		});

		console.log(
			"[Inbound Email] Storing inbound message in emailThreadMessages...",
		);
		const result = await ctx.runMutation(
			internal.emailThreadMessages.createInbound,
			{
				emailNoteId,
				messageId: message_id,
				textContent,
				from,
			},
		);

		if (!result) {
			console.warn(
				`[Inbound Email] ✗ Failed to store inbound message - emailNote ${emailNoteId} not found in database`,
			);
			return { success: true };
		}
		console.log(
			`[Inbound Email] ✓ Stored inbound message: threadMessageId=${result.threadMessageId}`,
		);

		console.log(
			`[Inbound Email] Triggering processEmailReply action for note ${result.emailNoteId}`,
		);
		await ctx.runAction(internal.emailReply.processEmailReply, {
			emailNoteId: result.emailNoteId,
			inboundMessageId: message_id,
			textContent,
			from,
		});

		const totalTime = Date.now() - startTime;
		console.log(
			`[Inbound Email] ========== END processInboundWebhook (${totalTime}ms) ==========`,
		);
		return { success: true };
	},
});
