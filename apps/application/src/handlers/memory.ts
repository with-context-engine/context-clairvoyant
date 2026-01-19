import { b } from "@clairvoyant/baml-client";
import { api } from "@convex/_generated/api";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { checkUserIsPro, convexClient } from "../core/convex";
import type { DisplayQueueManager } from "../core/displayQueue";

const memoryRunCallIds = new WeakMap<AppSession, number>();

export async function MemoryCapture(
	textArtifact: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	peerId: string,
	mentraUserId: string,
	displayQueue: DisplayQueueManager,
) {
	const runId = Date.now();
	memoryRunCallIds.set(session, runId);

	session.logger.info(
		`[startMemoryCaptureFlow] Starting memory capture flow for text artifact: ${textArtifact}`,
	);

	const isPro = await checkUserIsPro(mentraUserId);
	if (!isPro) {
		session.logger.warn(
			"[MemoryCapture] User isn't Pro, memory capture disabled.",
		);
		displayQueue.enqueue({
			text: "// Clairvoyant\nM: Memory is a Pro feature.",
			prefix: "M",
			durationMs: 3000,
			priority: 1,
		});
		return;
	}

	// Fetch user to get their _id for peer lookup
	const user = await convexClient.query(
		api.payments.getCurrentUserWithSubscription,
		{ mentraUserId },
	);

	if (!user) {
		session.logger.error(
			`[MemoryCapture] User not found for mentraUserId: ${mentraUserId}`,
		);
		return;
	}

	const userId = user._id;

	try {
		const PeerChoice = peers.find((peer) => peer.id === `${userId}-${peerId}`);
		if (PeerChoice) {
			await memorySession.addMessages([
				{
					peer_id: PeerChoice.id,
					content: textArtifact,
					metadata: {
						timestamp: new Date().toISOString(),
						source: "handleTranscription",
					},
				},
			]);
		}
	} catch (error) {
		session.logger.error(`[startMemoryFlow] Error storing memory: ${error}`);
	}
}

export async function MemoryRecall(
	textQuery: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
	displayQueue: DisplayQueueManager,
) {
	const runId = Date.now();
	memoryRunCallIds.set(session, runId);

	session.logger.info(`[startMemoryRecallFlow] Starting memory recall flow`);

	const isPro = await checkUserIsPro(mentraUserId);
	if (!isPro) {
		session.logger.warn(
			"[MemoryRecall] User isn't Pro, memory recall disabled.",
		);
		displayQueue.enqueue({
			text: "// Clairvoyant\nR: Memory is a Pro feature.",
			prefix: "R",
			durationMs: 3000,
			priority: 1,
		});
		return;
	}

	// Fetch user to get their _id for peer lookup
	const user = await convexClient.query(
		api.payments.getCurrentUserWithSubscription,
		{ mentraUserId },
	);

	if (!user) {
		session.logger.error(
			`[MemoryRecall] User not found for mentraUserId: ${mentraUserId}`,
		);
		return;
	}

	const userId = user._id;

	try {
		const diatribePeer = peers.find((peer) => peer.id === `${userId}-diatribe`);
		if (diatribePeer) {
			// Capture the query as a memory first
			await memorySession.addMessages([
				{
					peer_id: diatribePeer.id,
					content: textQuery,
					metadata: {
						timestamp: new Date().toISOString(),
						source: "memoryRecall",
					},
				},
			]);

			// Fetch session summaries from Convex (cross-session episodic memory)
			let sessionSummaries: string[] = [];
			try {
				const summaries = await convexClient.query(
					api.sessionSummaries.getRecentForUser,
					{ mentraUserId, limit: 5 },
				);
				sessionSummaries = summaries.map((s) => {
					const date = new Date(s._creationTime).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
					});
					return `${date}: ${s.summary}`;
				});
			} catch (error) {
				session.logger.warn(
					`[startMemoryRecallFlow] Failed to fetch session summaries: ${error}`,
				);
			}

			// Get context data from Honcho (within-session + peer facts)
			let contextData: {
				messages: Array<{ content: string }>;
				peerRepresentation: string;
				peerCard: string[];
			};
			const contextStartTime = Date.now();
			try {
				contextData = (await memorySession.getContext({
					lastUserMessage: textQuery,
					peerTarget: diatribePeer.id,
					limitToSession: true,
				})) as typeof contextData;
				const contextDuration = Date.now() - contextStartTime;
				session.logger.info(
					`[startMemoryRecallFlow] getContext() completed in ${contextDuration}ms`,
				);
			} catch (error) {
				const contextDuration = Date.now() - contextStartTime;
				session.logger.error(
					`[startMemoryRecallFlow] Error getting context after ${contextDuration}ms: ${error}`,
				);
				return;
			}

			// Check if stale
			if (memoryRunCallIds.get(session) !== runId) {
				session.logger.info(
					`[startMemoryRecallFlow] Context arrived for stale request, discarding`,
				);
				return;
			}

			// Parse peerRepresentation JSON
			let peerRep: {
				explicit: Array<{ content: string }>;
				deductive: Array<{ conclusion: string; premises: string[] }>;
			};
			try {
				peerRep = JSON.parse(contextData.peerRepresentation);
			} catch (error) {
				session.logger.error(
					`[startMemoryRecallFlow] Error parsing peerRepresentation: ${error}`,
				);
				peerRep = { explicit: [], deductive: [] };
			}

			// Build memory context
			const memoryContext = {
				explicitFacts: peerRep.explicit.map((e) => e.content),
				deductiveFacts: peerRep.deductive.map(
					(d) => `${d.conclusion} (from: ${d.premises.join(", ")})`,
				),
				peerCard: contextData.peerCard,
				recentMessages: contextData.messages.slice(-5).map((m) => m.content),
				sessionSummaries,
			};

			// Synthesize response with BAML (replaces .chat() call)
			let synthesis: { lines: string[] };
			const synthesisStartTime = Date.now();
			try {
				synthesis = await b.SynthesizeMemory(textQuery, memoryContext);
				const synthesisDuration = Date.now() - synthesisStartTime;
				session.logger.info(
					`[startMemoryRecallFlow] SynthesizeMemory() completed in ${synthesisDuration}ms`,
				);
			} catch (error) {
				const synthesisDuration = Date.now() - synthesisStartTime;
				session.logger.error(
					`[startMemoryRecallFlow] Error during synthesis after ${synthesisDuration}ms: ${error}`,
				);
				return;
			}

			// Check if this is still the current request
			if (memoryRunCallIds.get(session) !== runId) {
				session.logger.info(
					`[startMemoryRecallFlow] Synthesis arrived for stale request, discarding`,
				);
				return;
			}

			// Process the memory synthesis results
			const lines = synthesis.lines;
			if (lines && lines.length > 0) {
				// Display each line via displayQueue
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];

					// Check if this is still the current request before each line
					if (memoryRunCallIds.get(session) !== runId) return;

					session.logger.info(
						`[startMemoryRecallFlow] Memory synthesis line: ${line}`,
					);
					displayQueue.enqueue({
						text: `// Clairvoyant\nR: ${line}`,
						prefix: "R",
						durationMs: 3000,
						priority: 2,
					});
				}
			} else {
				session.logger.error(
					`[startMemoryRecallFlow] No lines in synthesis results`,
				);
			}
		}
	} catch (error) {
		session.logger.error(
			`[startMemoryRecallFlow] Error recalling memory: ${error}`,
		);
	}
}
