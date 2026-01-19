"use node";

import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

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
				"Give me context about this user for a followup chat conversation",
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
			`[FollowupChat] Could not fetch memory context: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

interface User {
	_id: Id<"users">;
	mentraUserId: string;
}

interface Followup {
	_id: Id<"followups">;
	userId: Id<"users">;
	topic: string;
	summary: string;
	sourceMessages: string[];
}

interface FollowupChatMessage {
	_id: Id<"followupChatMessages">;
	_creationTime: number;
	followupId: Id<"followups">;
	role: "user" | "assistant";
	content: string;
}

interface FollowupChatResponse {
	response: string;
	extractedFacts: string[];
}

export const sendFollowupMessage = action({
	args: {
		mentraUserId: v.string(),
		followupId: v.id("followups"),
		content: v.string(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		success: boolean;
		response?: string;
		error?: string;
	}> => {
		const { mentraUserId, followupId, content } = args;

		console.log("[FollowupChat] ========== START sendFollowupMessage ==========");
		console.log("[FollowupChat] Input:", {
			mentraUserId,
			followupId,
			contentLength: content.length,
		});

		const user = (await ctx.runQuery(
			internal.users.getByMentraIdInternalQuery,
			{ mentraUserId },
		)) as User | null;

		if (!user) {
			console.error(`[FollowupChat] User not found for mentraUserId: ${mentraUserId}`);
			return { success: false, error: "user_not_found" };
		}
		console.log(`[FollowupChat] User found: ${user._id}`);

		const followup = (await ctx.runQuery(
			internal.followups.getByIdInternal,
			{ followupId },
		)) as Followup | null;

		if (!followup) {
			console.error(`[FollowupChat] Followup not found: ${followupId}`);
			return { success: false, error: "followup_not_found" };
		}

		if (followup.userId !== user._id) {
			console.error(`[FollowupChat] Followup ${followupId} does not belong to user ${user._id}`);
			return { success: false, error: "unauthorized" };
		}
		console.log(`[FollowupChat] Followup validated: ${followup.topic}`);

		const existingMessages = (await ctx.runQuery(
			internal.followupsChatQueries.getMessagesInternal,
			{ followupId },
		)) as FollowupChatMessage[];
		console.log(`[FollowupChat] Loaded ${existingMessages.length} existing messages`);

		const honchoKey = process.env.HONCHO_API_KEY;

		const [memoryContext, searchResults] = await Promise.all([
			honchoKey ? fetchMemoryContext(user._id, honchoKey) : Promise.resolve(null),
			ctx.runAction(internal.tavilySearch.performWebSearch, {
				query: `${followup.topic} ${content}`,
				maxResults: 3,
			}),
		]);

		if (memoryContext) {
			console.log(`[FollowupChat] Memory context: ${memoryContext.userFacts.length} facts`);
		}
		console.log(`[FollowupChat] Search results: ${searchResults.length} results`);

		const interpretation = (await ctx.runAction(
			internal.bamlActions.interpretFollowupChat,
			{
				userMessage: content,
				context: {
					topic: followup.topic,
					summary: followup.summary,
					sourceMessages: followup.sourceMessages,
					conversationHistory: existingMessages.map((m) => ({
						role: m.role,
						content: m.content,
						createdAt: new Date(m._creationTime).toISOString(),
					})),
					memory: memoryContext ? {
						userName: memoryContext.userName ?? null,
						userFacts: memoryContext.userFacts,
						deductiveFacts: memoryContext.deductiveFacts,
					} : null,
					searchResults: searchResults,
				},
			},
		)) as FollowupChatResponse;

		console.log("[FollowupChat] Interpretation:", {
			responseLength: interpretation.response.length,
			extractedFacts: interpretation.extractedFacts,
		});

		await ctx.runMutation(
			internal.followupsChatQueries.insertMessage,
			{
				followupId,
				role: "user" as const,
				content,
			},
		);
		console.log(`[FollowupChat] Stored user message`);

		await ctx.runMutation(
			internal.followupsChatQueries.insertMessage,
			{
				followupId,
				role: "assistant" as const,
				content: interpretation.response,
			},
		);
		console.log(`[FollowupChat] Stored assistant message`);

		// Update Honcho memory with extracted facts (diatribe peer) and assistant response (synthesis peer)
		if (honchoKey) {
			try {
				const honchoClient = new Honcho({
					apiKey: honchoKey,
					environment: "production",
					workspaceId: "with-context",
				});

				const followupSessionId = `followup-chat-${followupId}`;
				const session = await honchoClient.session(followupSessionId);

				// Get or create both peers
				const diatribePeer = await honchoClient.peer(`${user._id}-diatribe`, {
					metadata: {
						name: "Diatribe",
						description: "A peer that listens to the raw translations of the users' speech.",
					},
				});
				const synthesisPeer = await honchoClient.peer(`${user._id}-synthesis`, {
					metadata: {
						name: "Synthesis Peer",
						description: "A peer that captures synthesized knowledge from the user's speech.",
					},
				});

				await session.addPeers([diatribePeer, synthesisPeer]);

				// Add user message + extracted facts to diatribe peer
				const userContent = interpretation.extractedFacts.length > 0
					? `${content}\n\nExtracted facts:\n${interpretation.extractedFacts.map((f) => `• ${f}`).join("\n")}`
					: content;

				await session.addMessages([
					{
						peer_id: diatribePeer.id,
						content: userContent,
						metadata: {
							timestamp: new Date().toISOString(),
							source: "followup_chat",
							type: "user_message",
							followupId: followupId,
							topic: followup.topic,
						},
					},
				]);
				console.log(`[FollowupChat] Added user message to diatribe peer${interpretation.extractedFacts.length > 0 ? ` with ${interpretation.extractedFacts.length} facts` : ""}`);

				// Add assistant response to synthesis peer
				await session.addMessages([
					{
						peer_id: synthesisPeer.id,
						content: interpretation.response,
						metadata: {
							timestamp: new Date().toISOString(),
							source: "followup_chat",
							type: "assistant_response",
							followupId: followupId,
							topic: followup.topic,
						},
					},
				]);
				console.log(`[FollowupChat] Added assistant response to synthesis peer`);
			} catch (error) {
				console.warn(
					`[FollowupChat] Failed to update Honcho memory: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		console.log("[FollowupChat] ========== END sendFollowupMessage SUCCESS ==========");
		return {
			success: true,
			response: interpretation.response,
		};
	},
});
