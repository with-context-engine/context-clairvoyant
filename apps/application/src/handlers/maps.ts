import { api } from "@convex/_generated/api";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import {
	checkUserIsPro,
	convexClient,
	getDefaultLocation,
	setCurrentLocation,
} from "../core/convex";
import { showTextDuringOperation } from "../core/textWall";
import { getTimeAgo } from "../core/utils";
import type { PlaceSuggestion } from "../tools/mapsCall";
import { getPlaces } from "../tools/mapsCall";
import { MemoryCapture } from "./memory";

const mapsRunIds = new WeakMap<AppSession, number>();

/**
 * Helper function to process places data and display it.
 * Used by both GPS location callback and fallback location handler.
 */
async function processPlacesData(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
	places: PlaceSuggestion[],
	runId: number,
) {
	if (!places?.length) {
		session.layouts.showTextWall(
			"// Clairvoyant\nM: No nearby matches right now.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	// Fetch memory context if available
	let memoryContext: {
		userName?: string;
		userFacts: string[];
		deductiveFacts: string[];
	} | null = null;
	try {
		const isPro = await checkUserIsPro(mentraUserId);
		if (isPro) {
			const user = await convexClient.query(
				api.payments.getCurrentUserWithSubscription,
				{ mentraUserId },
			);
			if (user) {
				const userId = user._id;
				const diatribePeer = peers.find(
					(peer) => peer.id === `${userId}-diatribe`,
				);

				if (diatribePeer) {
					session.logger.info(
						"[Clairvoyant] Fetching memory context for maps personalization",
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

					// Extract maps-relevant deductive conclusions (e.g., location preferences, past searches)
					const mapsRelatedDeductions = peerRep.deductive
						.map((d) => d.conclusion)
						.filter(
							(conclusion: string) =>
								conclusion.toLowerCase().includes("location") ||
								conclusion.toLowerCase().includes("place") ||
								conclusion.toLowerCase().includes("restaurant") ||
								conclusion.toLowerCase().includes("prefer") ||
								conclusion.toLowerCase().includes("favorite") ||
								conclusion.toLowerCase().includes("near"),
						)
						.slice(0, 2); // Limit to top 2 relevant deductions

					// Extract recent location queries with timestamps
					const recentMessages = contextData.messages || [];
					const locationPattern =
						/find|near|close|restaurant|cafe|store|shop|location|place/i;
					const recentLocationQueries = recentMessages
						.filter((msg) => locationPattern.test(msg.content))
						.slice(-5) // Get last 5 location-related messages
						.map((msg) => {
							if (msg.metadata?.timestamp) {
								const timeAgo = getTimeAgo(msg.metadata.timestamp);
								return `Asked about "${msg.content.slice(0, 40)}${msg.content.length > 40 ? "..." : ""}" ${timeAgo}`;
							}
							return null;
						})
						.filter(Boolean) as string[];

					// Combine deductions with temporal information
					const deductionsWithTiming = mapsRelatedDeductions.concat(
						recentLocationQueries.slice(0, 1), // Add up to 1 recent location query timestamp
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
		}
	} catch (error) {
		session.logger.warn(
			`[Clairvoyant] Failed to fetch memory context: ${String(error)}`,
		);
	}

	const topPlaces = places.slice(0, 3);
	const placeLines = await b.SummarizePlaces(query, topPlaces, memoryContext);
	const lines = placeLines.lines;

	if (!lines?.length) {
		session.logger.warn("[startMapsFlow] SummarizePlaces returned no lines");
		session.layouts.showTextWall(
			"// Clairvoyant\nM: Couldn't summarize those spots.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	await MemoryCapture(
		lines.join("\n"),
		session,
		memorySession,
		peers,
		"synthesis",
		mentraUserId,
	);

	for (let i = 0; i < lines.length; i++) {
		if (mapsRunIds.get(session) !== runId) return;

		const line = lines[i];
		session.logger.info(`[startMapsFlow] Map result: ${line}`);
		session.layouts.showTextWall(`// Clairvoyant\nM: ${line}`, {
			view: ViewType.MAIN,
			durationMs: 3000,
		});

		if (i < lines.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 3000));
		}
	}
}

export async function startMapsFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
) {
	const runId = Date.now();
	mapsRunIds.set(session, runId);

	session.layouts.showTextWall("// Clairvoyant\nM: Checking nearby spots...", {
		view: ViewType.MAIN,
		durationMs: 2000,
	});

	let locationReceived = false;
	let statusWallActive = false;

	const unsubscribe = session.events.onLocation(async (location) => {
		if (mapsRunIds.get(session) !== runId) {
			session.logger.info(
				`[startMapsFlow] Ignoring stale location callback (runId: ${runId})`,
			);
			if (statusWallActive) {
				session.layouts.showTextWall("", {
					view: ViewType.MAIN,
					durationMs: 500,
				});
			}
			return;
		}

		if (locationReceived) return;
		locationReceived = true;

		try {
			unsubscribe?.();

			session.logger.info(
				`[startMapsFlow] Location received: ${location.lat}, ${location.lng}`,
			);

			// Update the user's current location in Convex (fire and forget)
			void setCurrentLocation(mentraUserId, {
				lat: location.lat,
				lng: location.lng,
			});

			statusWallActive = true;

			const places = await showTextDuringOperation(
				session,
				"// Clairvoyant\nM: Finding nearby matches...",
				"// Clairvoyant\nM: Found a few ideas!",
				"// Clairvoyant\nM: Couldn't find anything nearby.",
				() =>
					getPlaces(query, {
						latitude: location.lat,
						longitude: location.lng,
					}),
			);

			await MemoryCapture(
				query,
				session,
				memorySession,
				peers,
				"diatribe",
				mentraUserId,
			);

			statusWallActive = false;

			if (mapsRunIds.get(session) !== runId) {
				session.logger.info(
					`[startMapsFlow] Places response arrived for stale request, discarding`,
				);
				return;
			}

			await processPlacesData(
				query,
				session,
				memorySession,
				peers,
				mentraUserId,
				places,
				runId,
			);
		} catch (error) {
			statusWallActive = false;
			session.logger.error(`[startMapsFlow] Maps flow error: ${String(error)}`);

			if (mapsRunIds.get(session) === runId) {
				session.layouts.showTextWall(
					"// Clairvoyant\nM: Couldn't explore nearby spots.",
					{
						view: ViewType.MAIN,
						durationMs: 3000,
					},
				);
			}
		}
	});

	const TIMEOUT_MS = 6000;

	setTimeout(async () => {
		if (mapsRunIds.get(session) !== runId) return;
		if (locationReceived) return;

		session.logger.warn(
			`[startMapsFlow] Location timeout after ${TIMEOUT_MS}ms`,
		);

		unsubscribe?.();

		if (statusWallActive) {
			session.layouts.showTextWall("", {
				view: ViewType.MAIN,
				durationMs: 500,
			});
		}

		// Try to use default location from preferences (geocoded billing address)
		session.logger.info(
			"[startMapsFlow] Attempting to use default location from preferences",
		);

		const defaultLocation = await getDefaultLocation(mentraUserId);

		if (defaultLocation) {
			session.logger.info(
				`[startMapsFlow] Using default location: ${defaultLocation.lat}, ${defaultLocation.lng}`,
			);

			locationReceived = true; // Prevent further timeout messages

			session.layouts.showTextWall(
				"// Clairvoyant\nM: Using your billing location…",
				{
					view: ViewType.MAIN,
					durationMs: 2000,
				},
			);

			try {
				const places = await showTextDuringOperation(
					session,
					"// Clairvoyant\nM: Finding nearby matches...",
					"// Clairvoyant\nM: Found a few ideas!",
					"// Clairvoyant\nM: Couldn't find anything nearby.",
					() =>
						getPlaces(query, {
							latitude: defaultLocation.lat,
							longitude: defaultLocation.lng,
						}),
				);

				await MemoryCapture(
					query,
					session,
					memorySession,
					peers,
					"diatribe",
					mentraUserId,
				);

				if (mapsRunIds.get(session) !== runId) {
					session.logger.info(
						`[startMapsFlow] Places response arrived for stale request, discarding`,
					);
					return;
				}

				await processPlacesData(
					query,
					session,
					memorySession,
					peers,
					mentraUserId,
					places,
					runId,
				);
			} catch (error) {
				session.logger.error(
					`[startMapsFlow] Maps flow error with fallback location: ${String(error)}`,
				);

				if (mapsRunIds.get(session) === runId) {
					session.layouts.showTextWall(
						"// Clairvoyant\nM: Couldn't explore nearby spots.",
						{
							view: ViewType.MAIN,
							durationMs: 3000,
						},
					);
				}
			}
		} else {
			// No default location available
			session.layouts.showTextWall(
				"// Clairvoyant\nM: Still waiting on your location…",
				{
					view: ViewType.MAIN,
					durationMs: 2000,
				},
			);

			setTimeout(() => {
				if (mapsRunIds.get(session) !== runId) return;
				if (locationReceived) return;

				session.layouts.showTextWall(
					"// Clairvoyant\nM: Couldn't get your location.",
					{
						view: ViewType.MAIN,
						durationMs: 2000,
					},
				);
			}, 2000);
		}
	}, TIMEOUT_MS);
}
