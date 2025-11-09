import type { Peer, Session } from "@honcho-ai/sdk";
import { type AppSession, ViewType } from "@mentra/sdk";
import { b } from "../baml_client";

const memoryRunCallIds = new WeakMap<AppSession, number>();

export async function MemoryCapture(
	textArtifact: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	peerId: string,
) {
	const runId = Date.now();
	memoryRunCallIds.set(session, runId);

	session.logger.info(
		`[startMemoryCaptureFlow] Starting memory capture flow for text artifact: ${textArtifact}`,
	);

	try {
		const PeerChoice = peers.find((peer) => peer.id === peerId);
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
) {
	const runId = Date.now();
	memoryRunCallIds.set(session, runId);

	session.logger.info(`[startMemoryRecallFlow] Starting memory recall flow`);

	try {
		const diatribePeer = peers.find((peer) => peer.id === "diatribe");
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

			try {
				session.logger.info(
					await memorySession.getContext({
						peerTarget: diatribePeer.id,
						lastUserMessage: textQuery,
					}),
				);
			} catch (error) {
				session.logger.error(
					`[startMemoryRecallFlow] Error getting context: ${error}`,
				);
			}

			// Show loading message
			session.layouts.showTextWall("// Clairvoyant\nR: Trying to remember...", {
				view: ViewType.MAIN,
				durationMs: 30000,
			});

			// Call chat directly
			let response: string;
			try {
				response = (await diatribePeer.chat(textQuery)) as string;
			} catch (error) {
				session.logger.error(
					`[startMemoryRecallFlow] Error during chat: ${error}`,
				);
				if (memoryRunCallIds.get(session) === runId) {
					session.layouts.showTextWall(
						"// Clairvoyant\nR: Couldn't remember!",
						{
							view: ViewType.MAIN,
							durationMs: 2000,
						},
					);
				}
				return;
			}

			if (response) {
				if (memoryRunCallIds.get(session) !== runId) {
					session.logger.info(
						`[startMemoryRecallFlow] Response arrived for stale request, discarding`,
					);
					return;
				}

				const memoryRecall = await b.MemoryQueryRecall(
					textQuery,
					response as string,
				);

				// Check if this is still the current request
				if (memoryRunCallIds.get(session) !== runId) {
					session.logger.info(
						`[startMemoryRecallFlow] Response arrived for stale request, discarding`,
					);
					return;
				}

				// Process the memory recall results
				if (
					memoryRecall.results?.lines &&
					memoryRecall.results.lines.length > 0
				) {
					const lines = memoryRecall.results.lines;

					// Display each line sequentially
					for (let i = 0; i < lines.length; i++) {
						const line = lines[i];

						// Check if this is still the current request before each line
						if (memoryRunCallIds.get(session) !== runId) return;

						session.logger.info(
							`[startMemoryRecallFlow] Memory recall line: ${line}`,
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
						`[startMemoryRecallFlow] No lines in memory recall results`,
					);
					if (memoryRunCallIds.get(session) === runId) {
						session.layouts.showTextWall(
							"// Clairvoyant\nR: No memories found.",
							{
								view: ViewType.MAIN,
								durationMs: 2000,
							},
						);
					}
				}
			}
		}
	} catch (error) {
		session.logger.error(
			`[startMemoryRecallFlow] Error recalling memory: ${error}`,
		);
		if (memoryRunCallIds.get(session) === runId) {
			session.layouts.showTextWall("// Clairvoyant\nR: Couldn't remember!", {
				view: ViewType.MAIN,
				durationMs: 2000,
			});
		}
	}
}
