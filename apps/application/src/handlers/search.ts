import { api } from "@convex/_generated/api";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { checkUserIsPro, convexClient } from "../core/convex";
import { showTextDuringOperation } from "../core/textWall";
import { getTimeAgo } from "../core/utils";
import { performWebSearch } from "../tools/webSearch";
import { MemoryCapture } from "./memory";

const webSearchRunIds = new WeakMap<AppSession, number>();

export async function startWebSearchFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
) {
	const runId = Date.now();
	webSearchRunIds.set(session, runId);

	session.logger.info(
		`[startWebSearchFlow] Starting web search flow for query: ${query}`,
	);

	const isPro = await checkUserIsPro(mentraUserId);
	if (!isPro) {
		session.logger.warn(
			"[startWebSearchFlow] User isn't subscribed, web search disabled.",
		);
		session.layouts.showTextWall(
			"// Clairvoyant\nS: Web search is a Pro feature.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	try {
		// Fetch memory context for query enhancement and personalization
		let memoryContext: {
			userName?: string;
			userFacts: string[];
			deductiveFacts: string[];
		} | null = null;
		try {
			const user = await convexClient.query(
				api.polar.getCurrentUserWithSubscription,
				{ mentraUserId },
			);
			if (user) {
				const userId = user._id;
				const diatribePeer = peers.find(
					(peer) => peer.id === `${userId}-diatribe`,
				);

				if (diatribePeer) {
					session.logger.info(
						"[Clairvoyant] Fetching memory context for search enhancement",
					);
					const contextData = (await memorySession.getContext({
						peerTarget: diatribePeer.id,
						lastUserMessage: query,
					})) as {
						peerCard: string[];
						peerRepresentation: string;
						messages: Array<{
							content: string;
							metadata?: { timestamp?: string };
						}>;
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
					const userName = contextData.peerCard
						.find((fact: string) => fact.startsWith("Name:"))
						?.replace("Name:", "")
						.trim();
					const relevantFacts = contextData.peerCard
						.slice(0, 3)
						.filter((fact: string) => !fact.startsWith("Name:"));

					// Extract search-relevant deductive conclusions
					const searchRelatedDeductions = peerRep.deductive
						.map((d) => d.conclusion)
						.filter(
							(conclusion: string) =>
								conclusion.toLowerCase().includes("interest") ||
								conclusion.toLowerCase().includes("prefer") ||
								conclusion.toLowerCase().includes("work") ||
								conclusion.toLowerCase().includes("technology") ||
								conclusion.toLowerCase().includes("like"),
						)
						.slice(0, 2);

					// Extract recent search queries with timestamps
					const recentMessages = contextData.messages || [];
					const searchPattern = /search|find|look up|information|news|latest/i;
					const recentSearchQueries = recentMessages
						.filter((msg) => searchPattern.test(msg.content))
						.slice(-5)
						.map((msg) => {
							if (msg.metadata?.timestamp) {
								const timeAgo = getTimeAgo(msg.metadata.timestamp);
								return `Searched "${msg.content.slice(0, 40)}${msg.content.length > 40 ? "..." : ""}" ${timeAgo}`;
							}
							return null;
						})
						.filter(Boolean) as string[];

					// Combine deductions with temporal information
					const deductionsWithTiming = searchRelatedDeductions.concat(
						recentSearchQueries.slice(0, 2),
					);

					memoryContext = {
						userName,
						userFacts: relevantFacts,
						deductiveFacts: deductionsWithTiming,
					};
					session.logger.info(
						`[Clairvoyant] Memory context: ${JSON.stringify(memoryContext)}`,
					);
				}
			}
		} catch (error) {
			session.logger.warn(
				`[Clairvoyant] Failed to fetch memory context: ${String(error)}`,
			);
		}

		// LAYER 1: Enhance query with memory context
		let searchQuery = query;
		if (memoryContext) {
			try {
				const enhancedQuery = await b.EnhanceQuery(query, memoryContext);
				searchQuery = enhancedQuery.enhanced;
				session.logger.info(`[Clairvoyant] Enhanced query: "${searchQuery}"`);
			} catch (error) {
				session.logger.warn(
					`[Clairvoyant] Query enhancement failed, using original: ${String(error)}`,
				);
			}
		}

		const searchResults = await showTextDuringOperation(
			session,
			"// Clairvoyant\nS: Searching the web...",
			"// Clairvoyant\nS: Found it!",
			"// Clairvoyant\nS: Couldn't search the web.",
			() => performWebSearch(searchQuery),
		);

		await MemoryCapture(
			query,
			session,
			memorySession,
			peers,
			"diatribe",
			mentraUserId,
		);

		if (!searchResults) {
			throw new Error("No response from web search");
		}

		if (webSearchRunIds.get(session) !== runId) {
			session.logger.info(
				`[startWebSearchFlow] Web search response arrived for stale request, discarding`,
			);
			return;
		}

		// LAYER 2: Personalize response formatting with memory context
		const answerLines = await b.AnswerSearch(
			query,
			searchResults,
			memoryContext,
		);

		if (answerLines.results[0]?.lines?.length) {
			await MemoryCapture(
				answerLines.results[0]?.lines?.join("\n"),
				session,
				memorySession,
				peers,
				"synthesis",
				mentraUserId,
			);
		}

		if (webSearchRunIds.get(session) !== runId) {
			session.logger.info(
				`[startWebSearchFlow] Web search response arrived for stale request, discarding`,
			);
			return;
		}

		const lines = answerLines.results[0]?.lines;

		if (lines?.length) {
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (webSearchRunIds.get(session) !== runId) return;
				session.logger.info(`[startWebSearchFlow] Web search result: ${line}`);
				session.layouts.showTextWall(`// Clairvoyant\nS: ${line}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});
				if (i < lines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}
		} else {
			session.logger.error(`[startWebSearchFlow] No lines in answerLines`);
		}
	} catch (error) {
		session.logger.error(
			`[startWebSearchFlow] Web search flow error: ${String(error)}`,
		);
	}
}
