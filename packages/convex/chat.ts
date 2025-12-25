"use node";

import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import Groq from "groq-sdk";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

interface User {
	_id: Id<"users">;
	mentraUserId: string;
	email?: string;
}

interface SessionSummary {
	honchoSessionId: string;
	summary: string;
	topics: string[];
	startedAt: string;
	endedAt: string;
}

interface ChatMessage {
	_id: Id<"chatMessages">;
	userId: Id<"users">;
	date: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

const ChatInterpretationSchema = z.object({
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
		.nullable()
		.describe(
			"Text to append to session summary if shouldUpdateSummary is true",
		),
});

type ChatInterpretation = z.infer<typeof ChatInterpretationSchema>;

interface MemoryContext {
	userName?: string;
	userFacts: string[];
	deductiveFacts: string[];
}

interface ChatContext {
	date: string;
	sessionSummaries: SessionSummary[];
	memoryContext: MemoryContext | null;
	conversationHistory: Array<{
		role: "user" | "assistant";
		content: string;
		createdAt: string;
	}>;
}

async function interpretChatMessage(
	userMessage: string,
	context: ChatContext,
): Promise<ChatInterpretation | null> {
	const groqKey = process.env.GROQ_API_KEY;
	if (!groqKey) {
		console.error("[Chat] GROQ_API_KEY not set");
		return null;
	}

	const groq = new Groq({ apiKey: groqKey });

	const systemPrompt = `You are Clairvoyant, a friendly AI assistant that helps users reflect on their day through chat conversations.

The user is chatting with you about their day. Analyze their message and provide a JSON response with:
1. "response": A warm, conversational reply (2-3 sentences max)
2. "extractedFacts": Array of new facts about the user worth remembering (empty array if none)
3. "newTopics": Array of new topics to tag this session with (1-2 word tags, empty if none)
4. "shouldUpdateSummary": Boolean - whether to update the session summary
5. "summaryAddition": String or null - text to append to session summary if shouldUpdateSummary is true

Style:
- Be warm and casual, like a friend
- Use their name if known
- Reference session context naturally
- Keep responses brief - this is chat, not an essay
- Don't be overly enthusiastic or use excessive exclamation marks

IMPORTANT: Respond with ONLY valid JSON matching the schema above. No markdown, no code blocks, just the JSON object.`;

	const sessionsContext =
		context.sessionSummaries.length > 0
			? `SESSIONS FROM ${context.date}:\n${context.sessionSummaries.map((s) => `- ${s.summary}\n  Topics: ${s.topics.join(", ")}\n  Time: ${s.startedAt} to ${s.endedAt}`).join("\n")}\n`
			: `No sessions recorded for ${context.date} yet.\n`;

	let userProfileSection = "";
	if (context.memoryContext) {
		const { userName, userFacts, deductiveFacts } = context.memoryContext;
		const profileParts: string[] = [];
		if (userName) profileParts.push(`Name: ${userName}`);
		if (userFacts.length > 0)
			profileParts.push(
				`Known facts:\n${userFacts.map((f) => `- ${f}`).join("\n")}`,
			);
		if (deductiveFacts.length > 0)
			profileParts.push(
				`Inferred:\n${deductiveFacts.map((f) => `- ${f}`).join("\n")}`,
			);
		if (profileParts.length > 0) {
			userProfileSection = `USER PROFILE:\n${profileParts.join("\n")}\n`;
		}
	}

	const userPrompt = `DATE: ${context.date}

${sessionsContext}

${userProfileSection}

${context.conversationHistory.length > 0 ? `CONVERSATION HISTORY:\n${context.conversationHistory.map((m) => `[${m.role}] ${m.content}`).join("\n---\n")}\n` : ""}

USER'S NEW MESSAGE:
${userMessage}

Respond with JSON only.`;

	try {
		const completion = await groq.chat.completions.create({
			model: "openai/gpt-oss-120b",
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: userPrompt },
			],
			temperature: 0.7,
			max_tokens: 500,
			response_format: { type: "json_object" },
		});

		const content = completion.choices[0]?.message?.content;
		if (!content) {
			console.error("[Chat] No content from Groq");
			return null;
		}

		console.log("[Chat] Raw Groq response:", content);

		const parsed = ChatInterpretationSchema.parse(JSON.parse(content));
		return parsed;
	} catch (error) {
		console.error(
			`[Chat] Groq interpretation failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

async function fetchMemoryContext(
	userId: string,
	honchoKey: string,
): Promise<MemoryContext | null> {
	try {
		const honchoClient = new Honcho({
			apiKey: honchoKey,
			environment: "production",
			workspaceId: "with-context",
		});

		const diatribePeer = await honchoClient.peer(`${userId}-diatribe`);

		const chatSessionId = `chat-context-${userId}`;
		const session = await honchoClient.session(chatSessionId);
		await session.addPeers([diatribePeer]);

		const contextData = (await session.getContext({
			peerTarget: diatribePeer.id,
			lastUserMessage:
				"Give me context about this user for a chat conversation",
		})) as {
			peerCard: string[];
			peerRepresentation: string;
		};

		let peerRep: {
			explicit: Array<{ content: string }>;
			deductive: Array<{ conclusion: string; premises: string[] }>;
		};
		try {
			peerRep = JSON.parse(contextData.peerRepresentation);
		} catch {
			peerRep = { explicit: [], deductive: [] };
		}

		const userName = contextData.peerCard
			.find((fact: string) => fact.toLowerCase().startsWith("name:"))
			?.replace(/^name:/i, "")
			.trim();

		const userFacts = peerRep.explicit.map((e) => e.content).slice(0, 10);
		const deductiveFacts = peerRep.deductive
			.map((d) => d.conclusion)
			.slice(0, 5);

		return {
			userName,
			userFacts,
			deductiveFacts,
		};
	} catch (error) {
		console.warn(
			`[Chat] Could not fetch memory context: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

export const sendMessage = action({
	args: {
		mentraUserId: v.string(),
		date: v.string(),
		content: v.string(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		response?: string;
		messageId?: Id<"chatMessages">;
		error?: string;
	}> => {
		const { mentraUserId, date, content } = args;

		console.log("[Chat] ========== START sendMessage ==========");
		console.log("[Chat] Input:", {
			mentraUserId,
			date,
			contentLength: content.length,
		});

		const user = (await ctx.runQuery(
			internal.users.getByMentraIdInternalQuery,
			{ mentraUserId },
		)) as User | null;

		if (!user) {
			console.error(`[Chat] User not found for mentraUserId: ${mentraUserId}`);
			return { success: false, error: "user_not_found" };
		}
		console.log(`[Chat] User found: ${user._id}`);

		const sessionSummaries = (await ctx.runQuery(
			internal.chatQueries.getSessionSummariesForDate,
			{ userId: user._id, date },
		)) as SessionSummary[];
		console.log(
			`[Chat] Loaded ${sessionSummaries.length} session summaries for ${date}`,
		);
		if (sessionSummaries.length > 0) {
			console.log(
				"[Chat] Session summaries:",
				JSON.stringify(sessionSummaries, null, 2),
			);
		}

		const existingMessages = (await ctx.runQuery(
			internal.chatQueries.getMessagesInternal,
			{ userId: user._id, date },
		)) as ChatMessage[];
		console.log(`[Chat] Loaded ${existingMessages.length} existing messages`);

		let memoryContext: MemoryContext | null = null;
		const honchoKey = process.env.HONCHO_API_KEY;
		if (honchoKey) {
			memoryContext = await fetchMemoryContext(user._id, honchoKey);
			if (memoryContext) {
				console.log(
					`[Chat] Memory context fetched: ${memoryContext.userFacts.length} facts, ${memoryContext.deductiveFacts.length} deductions, name: ${memoryContext.userName ?? "unknown"}`,
				);
			}
		}

		const context: ChatContext = {
			date,
			sessionSummaries,
			memoryContext,
			conversationHistory: existingMessages.map((m) => ({
				role: m.role,
				content: m.content,
				createdAt: m.createdAt,
			})),
		};

		const interpretation = await interpretChatMessage(content, context);

		if (!interpretation) {
			console.error("[Chat] Failed to interpret message");
			return { success: false, error: "interpretation_failed" };
		}

		console.log("[Chat] Interpretation:", {
			responseLength: interpretation.response.length,
			extractedFacts: interpretation.extractedFacts,
			newTopics: interpretation.newTopics,
			shouldUpdateSummary: interpretation.shouldUpdateSummary,
		});

		const now = new Date().toISOString();

		const userMessageId = await ctx.runMutation(
			internal.chatQueries.insertMessage,
			{
				userId: user._id,
				date,
				role: "user" as const,
				content,
				createdAt: now,
			},
		);
		console.log(`[Chat] Stored user message: ${userMessageId}`);

		const assistantMessageId = await ctx.runMutation(
			internal.chatQueries.insertMessage,
			{
				userId: user._id,
				date,
				role: "assistant" as const,
				content: interpretation.response,
				createdAt: new Date().toISOString(),
			},
		);
		console.log(`[Chat] Stored assistant message: ${assistantMessageId}`);

		if (interpretation.extractedFacts.length > 0 && honchoKey) {
			console.log(
				`[Chat] Adding ${interpretation.extractedFacts.length} facts to Honcho...`,
			);
			try {
				const honchoClient = new Honcho({
					apiKey: honchoKey,
					environment: "production",
					workspaceId: "with-context",
				});
				const diatribePeer = await honchoClient.peer(`${user._id}-diatribe`);

				const session = await honchoClient.session(`chat-${date}-${user._id}`);

				const factsContent = interpretation.extractedFacts
					.map((fact) => `• ${fact}`)
					.join("\n");

				await session.addMessages([
					{
						peer_id: diatribePeer.id,
						content: `New facts learned from chat conversation:\n${factsContent}`,
						metadata: {
							timestamp: new Date().toISOString(),
							source: "web_chat",
							type: "user_facts",
							date,
						},
					},
				]);

				console.log(
					`[Chat] Added ${interpretation.extractedFacts.length} facts to Honcho`,
				);
			} catch (error) {
				console.warn(
					`[Chat] Failed to add facts to Honcho: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		if (
			interpretation.shouldUpdateSummary &&
			interpretation.summaryAddition &&
			sessionSummaries.length > 0
		) {
			console.log("[Chat] Updating session summary...");
			const latestSession = sessionSummaries[sessionSummaries.length - 1];
			if (latestSession) {
				const sessionFromDb = await ctx.runQuery(
					internal.sessionSummaries.getByHonchoSessionIdInternal,
					{ honchoSessionId: latestSession.honchoSessionId },
				);

				if (sessionFromDb) {
					const updatedTopics = [
						...new Set([...latestSession.topics, ...interpretation.newTopics]),
					];
					const enrichedSummary = `${latestSession.summary} ${interpretation.summaryAddition}`;

					await ctx.runMutation(internal.sessionSummaries.updateInternal, {
						sessionSummaryId: sessionFromDb._id,
						summary: enrichedSummary,
						topics: updatedTopics,
					});
					console.log(
						`[Chat] Updated sessionSummary: added ${interpretation.newTopics.length} new topics`,
					);

					await ctx.runAction(internal.dailySynthesis.synthesizeDailySummary, {
						userId: user._id,
						date,
					});
					console.log(`[Chat] Daily synthesis complete for ${date}`);
				}
			}
		}

		console.log("[Chat] ========== END sendMessage SUCCESS ==========");
		return {
			success: true,
			response: interpretation.response,
			messageId: assistantMessageId,
		};
	},
});

export const resynthesizeDay = action({
	args: {
		mentraUserId: v.string(),
		date: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean }> => {
		const { mentraUserId, date } = args;

		const user = (await ctx.runQuery(
			internal.users.getByMentraIdInternalQuery,
			{ mentraUserId },
		)) as User | null;

		if (!user) {
			console.error(
				`[Chat] resynthesizeDay: User not found for mentraUserId: ${mentraUserId}`,
			);
			return { success: false };
		}

		console.log(`[Chat] Re-running daily synthesis for ${date}...`);
		await ctx.runAction(internal.dailySynthesis.synthesizeDailySummary, {
			userId: user._id,
			date,
		});
		console.log(`[Chat] Daily synthesis complete for ${date}`);

		return { success: true };
	},
});
