"use node";

import { randomUUID } from "node:crypto";
import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { resend } from "./resendClient";

interface EmailNote {
	_id: Id<"emailNotes">;
	mentraUserId: string;
	emailId: string;
	title: string;
	subject: string;
	sessionSummaryId?: Id<"sessionSummaries">;
	status: "queued" | "sent" | "delivered" | "bounced" | "complained";
	createdAt: string;
	updatedAt: string;
}

interface EmailThreadMessage {
	_id: Id<"emailThreadMessages">;
	emailNoteId: Id<"emailNotes">;
	messageId: string;
	direction: "outbound" | "inbound";
	resendEmailId?: string;
	textContent?: string;
	createdAt: string;
}

interface SessionSummary {
	_id: Id<"sessionSummaries">;
	userId: Id<"users">;
	honchoSessionId: string;
	summary: string;
	topics: string[];
	startedAt: string;
	endedAt: string;
}

interface User {
	_id: Id<"users">;
	mentraUserId: string;
	email?: string;
}

function generateMessageId(): string {
	return `<${randomUUID()}@notes.clairvoyant.with-context.co>`;
}

// Structured output schema for email reply interpretation
const EmailInterpretationSchema = z.object({
	response: z
		.string()
		.describe("Conversational reply to send back (2-3 sentences max)"),
	extractedFacts: z
		.array(z.string())
		.describe("New facts about the user to store in memory"),
	newTopics: z
		.array(z.string())
		.describe("New topics to add to session (1-2 word tags)"),
	shouldUpdateSummary: z
		.boolean()
		.describe("Whether the session summary should be enriched"),
	summaryAddition: z
		.string()
		.optional()
		.describe(
			"Text to append to session summary if shouldUpdateSummary is true",
		),
});

type EmailInterpretation = z.infer<typeof EmailInterpretationSchema>;

interface InterpretationContext {
	originalSubject: string;
	originalTitle: string;
	sessionSummary: string | null;
	sessionTopics: string[];
	peerCard: string[];
	conversationHistory: Array<{
		direction: "outbound" | "inbound";
		content: string;
		createdAt: string;
	}>;
}

/**
 * Interprets a user's email reply using OpenAI with structured output.
 * Extracts: response to send, new facts, new topics, and summary updates.
 */
async function interpretEmailReply(
	userMessage: string,
	context: InterpretationContext,
): Promise<EmailInterpretation | null> {
	const openaiKey = process.env.OPENAI_API_KEY;
	if (!openaiKey) {
		console.error("[EmailReply] OPENAI_API_KEY not set");
		return null;
	}

	const openai = new OpenAI({ apiKey: openaiKey });

	const systemPrompt = `You are Clairvoyant, a friendly AI assistant that helps users reflect on their day through email conversations.

The user is replying to a session note email. Analyze their reply and provide:
1. A warm, conversational response (2-3 sentences max)
2. Any new facts about the user worth remembering
3. New topics to tag this session with
4. Whether to update the session summary, and if so, what to add

Style:
- Be warm and casual, like a friend
- Use their name if known
- Reference session context naturally
- Keep responses brief - this is email, not an essay
- Don't be overly enthusiastic or use excessive exclamation marks`;

	const userPrompt = `EMAIL SUBJECT: ${context.originalSubject}

${context.sessionSummary ? `SESSION CONTEXT:\n${context.sessionSummary}\nTopics: ${context.sessionTopics.join(", ")}\n` : ""}

${context.peerCard.length > 0 ? `USER PROFILE:\n${context.peerCard.join("\n")}\n` : ""}

${context.conversationHistory.length > 1 ? `CONVERSATION HISTORY:\n${context.conversationHistory.map((m) => `[${m.direction}] ${m.content}`).join("\n---\n")}\n` : ""}

USER'S NEW REPLY:
${userMessage}

Interpret this reply and generate a response.`;

	try {
		const completion = await openai.chat.completions.parse({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			response_format: zodResponseFormat(
				EmailInterpretationSchema,
				"email_interpretation",
			),
			max_tokens: 500,
		});

		const parsed = completion.choices[0]?.message?.parsed;
		if (!parsed) {
			console.error("[EmailReply] No parsed response from OpenAI");
			return null;
		}

		return parsed;
	} catch (error) {
		console.error(
			`[EmailReply] OpenAI interpretation failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/**
 * Processes an inbound email reply:
 * 1. Loads context (emailNote, sessionSummary, Honcho peerCard)
 * 2. Calls OpenAI InterpretEmailReply function (Step 5)
 * 3. Updates memory (Step 6)
 * 4. Sends threaded reply back to user (Step 7)
 */
export const processEmailReply = internalAction({
	args: {
		emailNoteId: v.id("emailNotes"),
		inboundMessageId: v.string(),
		textContent: v.string(),
		from: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
		const startTime = Date.now();
		const { emailNoteId, inboundMessageId, textContent, from } = args;

		console.log("[EmailReply] ========== START processEmailReply ==========");
		console.log("[EmailReply] Input:", {
			emailNoteId,
			inboundMessageId,
			from,
			textContentLength: textContent.length,
			textPreview:
				textContent.substring(0, 100) + (textContent.length > 100 ? "..." : ""),
		});

		// 1. Load emailNote
		console.log("[EmailReply] Step 1: Loading emailNote...");
		const emailNote = (await ctx.runQuery(internal.emailNotes.getByIdInternal, {
			emailNoteId,
		})) as EmailNote | null;

		if (!emailNote) {
			console.error(`[EmailReply] ✗ EmailNote not found: ${emailNoteId}`);
			return { success: false, error: "email_note_not_found" };
		}
		console.log("[EmailReply] ✓ EmailNote loaded:", {
			mentraUserId: emailNote.mentraUserId,
			subject: emailNote.subject,
			sessionSummaryId: emailNote.sessionSummaryId ?? "none",
		});

		// 2. Load thread messages for building References header
		console.log("[EmailReply] Step 2: Loading thread messages...");
		const threadMessages = (await ctx.runQuery(
			internal.emailThreadMessages.getByEmailNoteInternal,
			{ emailNoteId },
		)) as EmailThreadMessage[];
		console.log(
			`[EmailReply] ✓ Loaded ${threadMessages.length} thread messages`,
		);

		// 3. Look up user by mentraUserId
		console.log("[EmailReply] Step 3: Looking up user...");
		const user = (await ctx.runQuery(
			internal.users.getByMentraIdInternalQuery,
			{
				mentraUserId: emailNote.mentraUserId,
			},
		)) as User | null;

		if (!user) {
			console.error(
				`[EmailReply] ✗ User not found for mentraUserId: ${emailNote.mentraUserId}`,
			);
			return { success: false, error: "user_not_found" };
		}

		if (!user.email) {
			console.error(`[EmailReply] ✗ User has no email: ${user._id}`);
			return { success: false, error: "user_no_email" };
		}
		console.log(`[EmailReply] ✓ User found: ${user._id}, email: ${user.email}`);

		// 4. Load linked sessionSummary if available
		console.log("[EmailReply] Step 4: Loading sessionSummary...");
		let sessionSummary: SessionSummary | null = null;
		if (emailNote.sessionSummaryId) {
			sessionSummary = await ctx.runQuery(
				internal.sessionSummaries.getByIdInternal,
				{ sessionSummaryId: emailNote.sessionSummaryId },
			);
			console.log("[EmailReply] ✓ SessionSummary loaded:", {
				topics: sessionSummary?.topics ?? [],
				summaryLength: sessionSummary?.summary?.length ?? 0,
			});
		} else {
			console.log("[EmailReply] No sessionSummaryId linked to this emailNote");
		}

		// 5. Fetch Honcho peerCard for context
		console.log("[EmailReply] Step 5: Fetching Honcho peerCard...");
		let peerCard: string[] = [];
		const honchoKey = process.env.HONCHO_API_KEY;
		if (honchoKey) {
			try {
				const honchoStartTime = Date.now();
				const honchoClient = new Honcho({
					apiKey: honchoKey,
					workspaceId: "with-context",
				});

				const diatribePeer = await honchoClient.peer(`${user._id}-diatribe`);
				const peerContext = await diatribePeer.chat(
					"Give me a brief profile of this user including their name, location, interests, and personality traits.",
				);
				if (typeof peerContext === "string" && peerContext) {
					peerCard = peerContext
						.split("\n")
						.filter((line: string) => line.trim());
				}
				console.log(
					`[EmailReply] ✓ Fetched peerCard in ${Date.now() - honchoStartTime}ms: ${peerCard.length} facts`,
				);
			} catch (error) {
				console.warn(
					`[EmailReply] ✗ Could not fetch peerCard: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		} else {
			console.warn("[EmailReply] HONCHO_API_KEY not set, skipping peerCard");
		}

		// 6. Build context for LLM interpretation
		console.log("[EmailReply] Step 6: Building LLM context...");
		const context = {
			originalSubject: emailNote.subject,
			originalTitle: emailNote.title,
			sessionSummary: sessionSummary?.summary ?? null,
			sessionTopics: sessionSummary?.topics ?? [],
			peerCard,
			conversationHistory: threadMessages.map((m) => ({
				direction: m.direction,
				content: m.textContent ?? "",
				createdAt: m.createdAt,
			})),
		};

		console.log("[EmailReply] ✓ Context built:", {
			subject: context.originalSubject,
			hasSummary: !!context.sessionSummary,
			topicsCount: context.sessionTopics.length,
			peerCardCount: context.peerCard.length,
			historyCount: context.conversationHistory.length,
		});

		// Step 7: Interpret the email reply with LLM
		console.log("[EmailReply] Step 7: Calling OpenAI to interpret reply...");
		const llmStartTime = Date.now();
		const interpretation = await interpretEmailReply(textContent, context);

		if (!interpretation) {
			console.error(
				"[EmailReply] ✗ Failed to interpret reply, will send fallback response",
			);
		} else {
			console.log(
				`[EmailReply] ✓ Interpretation complete in ${Date.now() - llmStartTime}ms:`,
				{
					responseLength: interpretation.response.length,
					responsePreview: `${interpretation.response.substring(0, 80)}...`,
					extractedFacts: interpretation.extractedFacts,
					newTopics: interpretation.newTopics,
					shouldUpdateSummary: interpretation.shouldUpdateSummary,
					summaryAddition: interpretation.summaryAddition ?? "none",
				},
			);
		}

		// Step 8: Update memory based on interpretation
		console.log("[EmailReply] Step 8: Updating memory...");
		if (interpretation) {
			// 8a. Add new facts to Honcho via session.addMessages
			if (interpretation.extractedFacts.length > 0 && honchoKey) {
				console.log(
					`[EmailReply] Adding ${interpretation.extractedFacts.length} facts to Honcho...`,
				);
				try {
					const honchoClient = new Honcho({
						apiKey: honchoKey,
						workspaceId: "with-context",
					});
					const diatribePeer = await honchoClient.peer(`${user._id}-diatribe`);

					const session = await honchoClient.session(
						`email-reply-${emailNoteId}`,
					);

					const factsContent = interpretation.extractedFacts
						.map((fact) => `• ${fact}`)
						.join("\n");

					await session.addMessages([
						{
							peer_id: diatribePeer.id,
							content: `New facts learned from email conversation:\n${factsContent}`,
							metadata: {
								timestamp: new Date().toISOString(),
								source: "email_reply",
								type: "user_facts",
								emailNoteId: emailNoteId,
							},
						},
					]);

					console.log(
						`[EmailReply] ✓ Added ${interpretation.extractedFacts.length} facts to Honcho`,
					);
				} catch (error) {
					console.warn(
						`[EmailReply] ✗ Failed to add facts to Honcho: ${error instanceof Error ? error.message : String(error)}`,
					);
				}
			} else {
				console.log("[EmailReply] No new facts to add to Honcho");
			}

			// 8b. Update sessionSummary if needed
			if (
				interpretation.shouldUpdateSummary &&
				interpretation.summaryAddition &&
				sessionSummary
			) {
				console.log("[EmailReply] Updating sessionSummary with new content...");
				const updatedTopics = [
					...new Set([...sessionSummary.topics, ...interpretation.newTopics]),
				];
				const enrichedSummary = `${sessionSummary.summary} ${interpretation.summaryAddition}`;

				await ctx.runMutation(internal.sessionSummaries.updateInternal, {
					sessionSummaryId: sessionSummary._id,
					summary: enrichedSummary,
					topics: updatedTopics,
				});
				console.log(
					`[EmailReply] ✓ Updated sessionSummary: added ${interpretation.newTopics.length} new topics`,
				);

				// 8c. Re-run daily synthesis for this date to update daily summary
				const sessionDate = sessionSummary.startedAt.split("T")[0];
				if (sessionDate) {
					console.log(
						`[EmailReply] Re-running daily synthesis for ${sessionDate}...`,
					);
					await ctx.runAction(internal.dailySynthesis.synthesizeDailySummary, {
						userId: user._id,
						date: sessionDate,
					});
					console.log(
						`[EmailReply] ✓ Daily synthesis complete for ${sessionDate}`,
					);
				}
			} else {
				console.log("[EmailReply] No session summary update needed");
			}
		} else {
			console.log("[EmailReply] Skipping memory updates (no interpretation)");
		}

		// Step 9: Build and send reply email with proper threading headers
		console.log("[EmailReply] Step 9: Building and sending reply email...");
		const newMessageId = generateMessageId();

		const inReplyTo = inboundMessageId;

		const allMessageIds = threadMessages.map((m) => m.messageId);
		if (!allMessageIds.includes(inboundMessageId)) {
			allMessageIds.push(inboundMessageId);
		}
		const references = allMessageIds.join(" ");

		const replySubject = emailNote.subject.startsWith("Re:")
			? emailNote.subject
			: `Re: ${emailNote.subject}`;

		const replyContent = interpretation
			? `${interpretation.response}

---
Sent by Clairvoyant`
			: `Thank you for your reply! I've received your message.

---
Sent by Clairvoyant`;

		const replyToAddress = `chat+${emailNoteId}@notes.clairvoyant.with-context.co`;

		console.log("[EmailReply] Email headers:", {
			newMessageId,
			inReplyTo,
			referencesCount: allMessageIds.length,
			replySubject,
			replyToAddress,
		});

		try {
			const sendStartTime = Date.now();
			const resendEmailId = await resend.sendEmail(ctx, {
				from: "Clairvoyant <noreply@notes.clairvoyant.with-context.co>",
				to: user.email,
				subject: replySubject,
				text: replyContent,
				replyTo: [replyToAddress],
				headers: [
					{ name: "Message-ID", value: newMessageId },
					{ name: "In-Reply-To", value: inReplyTo },
					{ name: "References", value: references },
				],
			});
			console.log(
				`[EmailReply] ✓ Resend API responded in ${Date.now() - sendStartTime}ms, emailId: ${resendEmailId}`,
			);

			await ctx.runMutation(internal.emailThreadMessages.create, {
				emailNoteId,
				messageId: newMessageId,
				direction: "outbound",
				resendEmailId,
				textContent: replyContent,
			});
			console.log(`[EmailReply] ✓ Stored outbound message in thread`);

			const totalTime = Date.now() - startTime;
			console.log(
				`[EmailReply] ========== END processEmailReply SUCCESS (${totalTime}ms) ==========`,
			);
			return { success: true };
		} catch (error) {
			console.error(
				`[EmailReply] ✗ Failed to send reply: ${error instanceof Error ? error.message : String(error)}`,
			);
			const totalTime = Date.now() - startTime;
			console.log(
				`[EmailReply] ========== END processEmailReply FAILED (${totalTime}ms) ==========`,
			);
			return { success: false, error: "send_failed" };
		}
	},
});
