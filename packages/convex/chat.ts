"use node";

import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";
import type { ChatInterpretation } from "./bamlActions";

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

interface MemoryContext {
	userName?: string;
	userFacts: string[];
	deductiveFacts: string[];
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

		const dailySummary = (await ctx.runQuery(
			internal.chatQueries.getDailySummaryForDate,
			{ userId: user._id, date },
		)) as { _id: Id<"dailySummaries"> } | null;
		const dailySummaryId = dailySummary?._id;
		console.log(
			`[Chat] Daily summary for ${date}: ${dailySummaryId ?? "none"}`,
		);

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

		const interpretation = (await ctx.runAction(
			internal.bamlActions.interpretChatMessage,
			{
				userMessage: content,
				context: {
					date,
					sessionSummaries: sessionSummaries.map((s) => ({
						summary: s.summary,
						topics: s.topics,
						startedAt: s.startedAt,
						endedAt: s.endedAt,
					})),
					userName: memoryContext?.userName,
					userFacts: memoryContext?.userFacts ?? [],
					deductiveFacts: memoryContext?.deductiveFacts ?? [],
					conversationHistory: existingMessages.map((m) => ({
						role: m.role,
						content: m.content,
						createdAt: m.createdAt,
					})),
				},
			},
		)) as ChatInterpretation;

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
				dailySummaryId,
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
				dailySummaryId,
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
