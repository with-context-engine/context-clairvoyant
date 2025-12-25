"use node";

import { v } from "convex/values";
import { b } from "../baml_client/baml_client";
import type {
	DailySummaryResult,
	EmailContext,
	EmailInterpretation,
	SessionInput,
} from "../baml_client/baml_client/types";
import { internalAction } from "./_generated/server";

export type { DailySummaryResult, EmailInterpretation };

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
