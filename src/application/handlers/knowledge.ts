import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { checkUserIsPro, convexClient } from "../core/convex";
import { showTextDuringOperation } from "../core/textWall";
import { MemoryCapture } from "./memory";
import { api } from "../../../convex/_generated/api";

const knowledgeRunIds = new WeakMap<AppSession, number>();

function getTimeAgo(timestamp: string): string {
	try {
		const now = new Date();
		const then = new Date(timestamp);
		const diffMs = now.getTime() - then.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 60) {
			return diffMins <= 1 ? "just now" : `${diffMins} minutes ago`;
		}
		if (diffHours < 24) {
			return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
		}
		if (diffDays < 7) {
			return diffDays === 1 ? "yesterday" : `${diffDays} days ago`;
		}
		if (diffDays < 30) {
			const weeks = Math.floor(diffDays / 7);
			return weeks === 1 ? "last week" : `${weeks} weeks ago`;
		}
		const months = Math.floor(diffDays / 30);
		return months === 1 ? "last month" : `${months} months ago`;
	} catch {
		return "recently";
	}
}

export async function startKnowledgeFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
) {
	const runId = Date.now();
	knowledgeRunIds.set(session, runId);

	session.logger.info(
		`[startKnowledgeFlow] Starting knowledge flow for query: ${query}`,
	);

	try {
		// Fetch memory context if available
		let memoryContext: { userName?: string; userFacts: string[]; deductiveFacts: string[] } | null = null;
		try {
			const isPro = await checkUserIsPro(mentraUserId);
			if (isPro) {
				const user = await convexClient.query(
					api.polar.getCurrentUserWithSubscription,
					{ mentraUserId },
				);
				if (user) {
					const userId = user._id;
					const diatribePeer = peers.find((peer) => peer.id === `${userId}-diatribe`);
					
					if (diatribePeer) {
						session.logger.info("[Clairvoyant] Fetching memory context for knowledge personalization");
						const contextData = await memorySession.getContext({
							peerTarget: diatribePeer.id,
							lastUserMessage: query,
						}) as {
							peerCard: string[];
							peerRepresentation: string;
							messages: Array<{ content: string; metadata?: { timestamp?: string } }>;
						};

						// Parse peerRepresentation JSON for explicit and deductive facts
						let peerRep: {
							explicit: Array<{ content: string }>;
							deductive: Array<{ conclusion: string; premises: string[] }>;
						};
						try {
							peerRep = JSON.parse(contextData.peerRepresentation);
						} catch (error) {
							session.logger.error(
								`[Clairvoyant] Error parsing peerRepresentation: ${error}`,
							);
							peerRep = { explicit: [], deductive: [] };
						}

						// Extract name and relevant facts from peerCard
						const userName = contextData.peerCard.find((fact: string) => fact.startsWith("Name:"))?.replace("Name:", "").trim();
						const relevantFacts = contextData.peerCard.slice(0, 3).filter((fact: string) => !fact.startsWith("Name:"));
						
						// Extract knowledge-relevant deductive conclusions (e.g., past questions, interests, learning patterns)
						const knowledgeRelatedDeductions = peerRep.deductive
							.map((d) => d.conclusion)
							.filter((conclusion: string) => 
								conclusion.toLowerCase().includes("question") ||
								conclusion.toLowerCase().includes("ask") ||
								conclusion.toLowerCase().includes("interest") ||
								conclusion.toLowerCase().includes("knowledge") ||
								conclusion.toLowerCase().includes("learn") ||
								conclusion.toLowerCase().includes("understand")
							)
							.slice(0, 3); // Limit to top 3 relevant deductions

						// Extract recent questions with timestamps to provide temporal context
						const recentMessages = contextData.messages || [];
						const questionPattern = /\?$/;
						const recentQuestions = recentMessages
							.filter(msg => questionPattern.test(msg.content.trim()))
							.slice(-5) // Get last 5 questions
							.map(msg => {
								if (msg.metadata?.timestamp) {
									const timeAgo = getTimeAgo(msg.metadata.timestamp);
									return `Asked "${msg.content.slice(0, 50)}${msg.content.length > 50 ? '...' : ''}" ${timeAgo}`;
								}
								return null;
							})
							.filter(Boolean) as string[];
						
						// Combine deductions with temporal information
						const deductionsWithTiming = knowledgeRelatedDeductions.concat(
							recentQuestions.slice(0, 2) // Add up to 2 recent question timestamps
						);
						
						memoryContext = {
							userName,
							userFacts: relevantFacts,
							deductiveFacts: deductionsWithTiming,
						};
						session.logger.info(`[Clairvoyant] Memory context: ${JSON.stringify(memoryContext)}`);
					}
				}
			}
		} catch (error) {
			session.logger.warn(`[Clairvoyant] Failed to fetch memory context: ${String(error)}`);
		}

		const response = await showTextDuringOperation(
			session,
			"",
			"",
			"",
			() => b.AnswerQuestion(query, memoryContext),
			{ view: ViewType.MAIN, clearDurationMs: 2000 },
		);

		await MemoryCapture(query, session, memorySession, peers, "diatribe", mentraUserId);

		if (knowledgeRunIds.get(session) !== runId) {
			session.logger.info(
				`[startKnowledgeFlow] Answer arrived for stale request, discarding`,
			);
			return;
		}

		if (response.has_question) {
			const questionLine = response.question ? `${response.question}` : "";

			const answerLines = Array.isArray(response.answer)
				? response.answer
				: response.answer
					? [response.answer as unknown as string]
					: [];

			if (answerLines.length === 0) {
				session.logger.warn(
					"[startKnowledgeFlow] AnswerQuestion returned no answer lines",
				);
				session.layouts.showTextWall(`// Clairvoyant\nK: ${questionLine}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});
				return;
			}

			await MemoryCapture(
				answerLines.join("\n"),
				session,
				memorySession,
				peers,
				"synthesis",
				mentraUserId,
			);

			for (let i = 0; i < answerLines.length; i++) {
				if (knowledgeRunIds.get(session) !== runId) return;

				const answerLabel = answerLines.length > 1 ? `A${i + 1}` : "A";
				const answerLine = `${answerLabel}: ${answerLines[i]}`;
				session.logger.info(
					`[startKnowledgeFlow] Knowledge line: ${answerLine}`,
				);

				const wallText = `// Clairvoyant\nQ: ${questionLine}\n${answerLine}`;
				session.layouts.showTextWall(wallText, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});

				if (i < answerLines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}
		} else {
			session.layouts.showTextWall("", {
				view: ViewType.MAIN,
				durationMs: 2000,
			});
		}
	} catch (error) {
		session.logger.error(
			`[startKnowledgeFlow] Knowledge flow error: ${String(error)}`,
		);

		if (knowledgeRunIds.get(session) === runId) {
			session.layouts.showTextWall(
				"// Clairvoyant\nK: Couldn't figure that out.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
		}
	}
}
