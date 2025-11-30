import { api } from "@convex/_generated/api";
import type { Peer, Session } from "@honcho-ai/sdk";
import { type AppSession, ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { checkUserIsPro, convexClient } from "../core/convex";

const memoryRunCallIds = new WeakMap<AppSession, number>();

export async function MemoryCapture(
	textArtifact: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	peerId: string,
	mentraUserId: string,
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
		session.layouts.showTextWall(
			"// Clairvoyant\nM: Memory is a Pro feature.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	// Fetch user to get their _id for peer lookup
	const user = await convexClient.query(
		api.polar.getCurrentUserWithSubscription,
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
) {
	const runId = Date.now();
	memoryRunCallIds.set(session, runId);

	session.logger.info(`[startMemoryRecallFlow] Starting memory recall flow`);

	const isPro = await checkUserIsPro(mentraUserId);
	if (!isPro) {
		session.logger.warn(
			"[MemoryRecall] User isn't Pro, memory recall disabled.",
		);
		session.layouts.showTextWall(
			"// Clairvoyant\nR: Memory is a Pro feature.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	// Fetch user to get their _id for peer lookup
	const user = await convexClient.query(
		api.polar.getCurrentUserWithSubscription,
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

			// Get context data from Honcho
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
				// Display each line sequentially
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i];

					// Check if this is still the current request before each line
					if (memoryRunCallIds.get(session) !== runId) return;

					session.logger.info(
						`[startMemoryRecallFlow] Memory synthesis line: ${line}`,
					);
					session.layouts.showTextWall(`// Clairvoyant\nR: ${line}`, {
						view: ViewType.MAIN,
						durationMs: 3000,
					});

					// Add delay between lines (except for the last line)
					if (i < lines.length - 1) {
						await new Promise((resolve) => setTimeout(resolve, 3000));
					}
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
