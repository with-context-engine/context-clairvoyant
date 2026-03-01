"use node";

import { randomUUID } from "node:crypto";
import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import type { EmailInterpretation } from "./bamlActions";
import { resend } from "./resendClient";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "notes.example.com";

interface EmailNote {
	_id: Id<"emailNotes">;
	userId: Id<"users">;
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
	return `<${randomUUID()}@${EMAIL_DOMAIN}>`;
}

/**
 * Processes an inbound email reply:
 * 1. Loads context (emailNote, sessionSummary, Honcho peerCard)
 * 2. Calls BAML InterpretEmailReply function
 * 3. Updates memory
 * 4. Sends threaded reply back to user
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
			userId: emailNote.userId,
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

		// 3. Look up user by userId
		console.log("[EmailReply] Step 3: Looking up user...");
		const user = (await ctx.runQuery(internal.users.getByIdInternal, {
			userId: emailNote.userId,
		})) as User | null;

		if (!user) {
			console.error(
				`[EmailReply] ✗ User not found for userId: ${emailNote.userId}`,
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

		// 5b. Cross-peer queries: fetch perspectives from connected users with shared memory
		let crossPeerPerspectives: Array<{ label: string; perspective: string }> = [];
		if (honchoKey) {
			try {
				const connections = (await ctx.runQuery(
					internal.connections.getActiveSharedMemoryConnections,
					{ userId: user._id },
				)) as Array<{ _id: Id<"connections">; connectedUserId: Id<"users">; label: string | null }>;

				const cappedConnections = connections.slice(0, 3);
				if (cappedConnections.length > 0) {
					console.log(`[EmailReply] Querying ${cappedConnections.length} cross-peer connections`);

					const crossPeerClient = new Honcho({
						apiKey: honchoKey,
						environment: "production",
						workspaceId: "with-context",
					});

					const rawPerspectives = await Promise.all(
						cappedConnections.map(async (conn) => {
							try {
								const connectedPeer = await crossPeerClient.peer(
									`${conn.connectedUserId}-diatribe`,
								);
								const rep = await connectedPeer.workingRep(undefined, `${user._id}-diatribe`, {
									searchQuery: emailNote.subject,
									searchTopK: 5,
									maxObservations: 10,
								});
								return {
									label: conn.label ?? "Connected user",
									perspective: rep.isEmpty() ? "" : rep.toStringNoTimestamps(),
								};
							} catch (error) {
								console.warn(
									`[EmailReply] Cross-peer query failed for ${conn.connectedUserId}: ${error instanceof Error ? error.message : String(error)}`,
								);
								return null;
							}
						}),
					);

					const validPerspectives = rawPerspectives.filter(
						(p): p is { label: string; perspective: string } =>
							p !== null && p.perspective.length > 0,
					);

					const sensitivityResults = await Promise.all(
						validPerspectives.map(async (p) => {
							const category = (await ctx.runAction(
								internal.bamlActions.checkSensitivity,
								{ crossPeerContext: p.perspective },
							)) as string;
							return { ...p, category };
						}),
					);

					crossPeerPerspectives = sensitivityResults
						.filter((p) => p.category === "SAFE")
						.map(({ label, perspective }) => ({ label, perspective }));

					console.log(
						`[EmailReply] Cross-peer: ${validPerspectives.length} valid, ${crossPeerPerspectives.length} safe`,
					);
				}
			} catch (error) {
				console.warn(
					`[EmailReply] Cross-peer lookup failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
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
			crossPeerPerspectives,
		};

		console.log("[EmailReply] ✓ Context built:", {
			subject: context.originalSubject,
			hasSummary: !!context.sessionSummary,
			topicsCount: context.sessionTopics.length,
			peerCardCount: context.peerCard.length,
			historyCount: context.conversationHistory.length,
		});

		// Step 7: Interpret the email reply with BAML
		console.log("[EmailReply] Step 7: Calling BAML to interpret reply...");
		const llmStartTime = Date.now();
		let interpretation: EmailInterpretation | null = null;
		try {
			interpretation = await ctx.runAction(
				internal.bamlActions.interpretEmailReply,
				{
					userMessage: textContent,
					context: {
						originalSubject: context.originalSubject,
						sessionSummary: context.sessionSummary ?? undefined,
						sessionTopics: context.sessionTopics,
						peerCard: context.peerCard,
						conversationHistory: context.conversationHistory.map((m) => ({
							direction: m.direction,
							content: m.content,
						})),
						crossPeerPerspectives: context.crossPeerPerspectives,
					},
				},
			);
		} catch (error) {
			console.error(
				`[EmailReply] ✗ BAML interpretation failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

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
		if (interpretation && honchoKey) {
			// 8a. Add user message + facts to diatribe peer AND assistant response to synthesis peer
			try {
				const honchoClient = new Honcho({
					apiKey: honchoKey,
					workspaceId: "with-context",
				});

				const session = await honchoClient.session(
					`email-reply-${emailNoteId}`,
				);

				// Get or create both peers
				const diatribePeer = await honchoClient.peer(`${user._id}-diatribe`, {
					metadata: {
						name: "Diatribe",
						description:
							"A peer that listens to the raw translations of the users' speech.",
					},
				});
				const synthesisPeer = await honchoClient.peer(`${user._id}-synthesis`, {
					metadata: {
						name: "Synthesis Peer",
						description:
							"A peer that captures synthesized knowledge from the user's speech.",
					},
				});

				await session.addPeers([diatribePeer, synthesisPeer]);

				// Add user email message + extracted facts to diatribe peer
				const userContent =
					interpretation.extractedFacts.length > 0
						? `${textContent}\n\nExtracted facts:\n${interpretation.extractedFacts.map((f) => `• ${f}`).join("\n")}`
						: textContent;

				await session.addMessages([
					{
						peer_id: diatribePeer.id,
						content: userContent,
						metadata: {
							timestamp: new Date().toISOString(),
							source: "email_reply",
							type: "user_message",
							emailNoteId: emailNoteId,
						},
					},
				]);
				console.log(
					`[EmailReply] ✓ Added user message to diatribe peer${interpretation.extractedFacts.length > 0 ? ` with ${interpretation.extractedFacts.length} facts` : ""}`,
				);

				// Add assistant response to synthesis peer
				await session.addMessages([
					{
						peer_id: synthesisPeer.id,
						content: interpretation.response,
						metadata: {
							timestamp: new Date().toISOString(),
							source: "email_reply",
							type: "assistant_response",
							emailNoteId: emailNoteId,
						},
					},
				]);
				console.log(
					`[EmailReply] ✓ Added assistant response to synthesis peer`,
				);
			} catch (error) {
				console.warn(
					`[EmailReply] ✗ Failed to update Honcho memory: ${error instanceof Error ? error.message : String(error)}`,
				);
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
		const access = await ctx.runAction(
			internal.emailEntitlementsNode.preflightOutboundEmail,
			{
				userId: user._id,
			},
		);
		if (!access.allowed) {
			return { success: false, error: access.reason ?? "email_limit_reached" };
		}

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

		const replyToAddress = `chat+${emailNoteId}@${EMAIL_DOMAIN}`;

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
				from: `Clairvoyant <noreply@${EMAIL_DOMAIN}>`,
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

			if (access.trackUsage) {
				await ctx.runMutation(
					internal.emailEntitlements.incrementOutboundUsage,
					{
						userId: user._id,
					},
				);
			}
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
