"use node";

import { v } from "convex/values";
import { b } from "../baml_client/baml_client";
import type {
	ChatContext,
	ChatInterpretation,
	DailySummaryResult,
	EmailContext,
	EmailInterpretation,
	FollowupChatContext,
	FollowupChatResponse,
	SessionInput,
} from "../baml_client/baml_client/types";
import { internalAction } from "./_generated/server";

export type { ChatInterpretation, DailySummaryResult, EmailInterpretation };

/**
 * BAML wrapper for daily session summarization.
 * Uses the SummarizeDailySessions function defined in baml_src/daily_summary.baml
 */
export const summarizeDailySessions = internalAction({
	args: {
		sessions: v.array(
			v.object({
				index: v.number(),
				summary: v.string(),
			}),
		),
		userProfile: v.optional(v.string()),
	},
	handler: async (
		_,
		{ sessions, userProfile },
	): Promise<DailySummaryResult> => {
		const sessionInputs: SessionInput[] = sessions.map((s) => ({
			index: s.index,
			summary: s.summary,
		}));

		const result = await b.SummarizeDailySessions(
			sessionInputs,
			userProfile ?? null,
		);
		return result;
	},
});

/**
 * BAML wrapper for email reply interpretation.
 * Uses the InterpretEmailReply function defined in baml_src/email_reply.baml
 */
export const interpretEmailReply = internalAction({
	args: {
		userMessage: v.string(),
		context: v.object({
			originalSubject: v.string(),
			sessionSummary: v.optional(v.string()),
			sessionTopics: v.array(v.string()),
			peerCard: v.array(v.string()),
			conversationHistory: v.array(
				v.object({
					direction: v.string(),
					content: v.string(),
				}),
			),
		}),
	},
	handler: async (
		_,
		{ userMessage, context },
	): Promise<EmailInterpretation> => {
		const emailContext: EmailContext = {
			originalSubject: context.originalSubject,
			sessionSummary: context.sessionSummary ?? null,
			sessionTopics: context.sessionTopics,
			peerCard: context.peerCard,
			conversationHistory: context.conversationHistory.map((m) => ({
				direction: m.direction,
				content: m.content,
			})),
		};

		const result = await b.InterpretEmailReply(userMessage, emailContext);
		return result;
	},
});

/**
 * BAML wrapper for chat message interpretation.
 * Uses the InterpretChatMessage function defined in baml_src/chat.baml
 */
export const interpretChatMessage = internalAction({
	args: {
		userMessage: v.string(),
		context: v.object({
			date: v.string(),
			sessionSummaries: v.array(
				v.object({
					summary: v.string(),
					topics: v.array(v.string()),
				}),
			),
			userName: v.optional(v.string()),
			userFacts: v.array(v.string()),
			deductiveFacts: v.array(v.string()),
			conversationHistory: v.array(
				v.object({
					role: v.string(),
					content: v.string(),
					createdAt: v.string(),
				}),
			),
		}),
	},
	handler: async (_, { userMessage, context }): Promise<ChatInterpretation> => {
		const chatContext: ChatContext = {
			date: context.date,
			sessionSummaries: context.sessionSummaries.map((s) => ({
				summary: s.summary,
				topics: s.topics,
			})),
			userName: context.userName ?? null,
			userFacts: context.userFacts,
			deductiveFacts: context.deductiveFacts,
			conversationHistory: context.conversationHistory.map((m) => ({
				role: m.role,
				content: m.content,
				createdAt: m.createdAt,
			})),
		};

		const result = await b.InterpretChatMessage(userMessage, chatContext);
		return result;
	},
});

export const interpretFollowupChat = internalAction({
	args: {
		userMessage: v.string(),
		context: v.object({
			topic: v.string(),
			summary: v.string(),
			sourceMessages: v.array(v.string()),
			conversationHistory: v.array(
				v.object({
					role: v.string(),
					content: v.string(),
					createdAt: v.string(),
				}),
			),
			memory: v.union(
				v.object({
					userName: v.union(v.string(), v.null()),
					userFacts: v.array(v.string()),
					deductiveFacts: v.array(v.string()),
				}),
				v.null(),
			),
			searchResults: v.array(
				v.object({
					title: v.string(),
					content: v.string(),
					url: v.string(),
				}),
			),
		}),
	},
	handler: async (_, { userMessage, context }): Promise<FollowupChatResponse> => {
		const followupContext: FollowupChatContext = {
			topic: context.topic,
			summary: context.summary,
			sourceMessages: context.sourceMessages,
			conversationHistory: context.conversationHistory.map((m) => ({
				role: m.role,
				content: m.content,
				createdAt: m.createdAt,
			})),
			memory: context.memory ? {
				userName: context.memory.userName ?? null,
				userFacts: context.memory.userFacts,
				deductiveFacts: context.memory.deductiveFacts,
			} : null,
			searchResults: context.searchResults.map((r) => ({
				title: r.title,
				content: r.content,
				url: r.url,
			})),
		};

		const result = await b.InterpretFollowupChat(userMessage, followupContext);
		return result;
	},
});
