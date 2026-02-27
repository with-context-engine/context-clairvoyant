import { b } from "@clairvoyant/baml-client";
import type { FormattedWeather } from "@clairvoyant/baml-client/types";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { updateConversationResponse } from "../core/conversationLogger";
import {
	checkUserIsPro,
	convexClient,
	getDefaultLocation,
	getUserPreferences,
	setCurrentLocation,
} from "../core/convex";
import type { DisplayQueueManager } from "../core/displayQueue";
import { showTextDuringOperation } from "../core/textWall";
import { getTimeAgo } from "../core/utils";
import { getWeatherData } from "../tools/weatherCall";

const weatherRunIds = new WeakMap<AppSession, number>();

/**
 * Helper function to process weather data and display it.
 * Used by both GPS location callback and fallback location handler.
 */
async function processWeatherData(
	session: AppSession,
	mentraUserId: string,
	response: FormattedWeather,
	preferredUnit: "C" | "F",
	runId: number,
	displayQueue: DisplayQueueManager,
	memorySession?: Session,
	peers?: Peer[],
	logContext?: { convexUserId: Id<"users">; sessionId: string; transcript: string },
) {
	// Fetch memory context if available
	let memoryContext: {
		userName?: string;
		userFacts: string[];
		deductiveFacts: string[];
	} | null = null;
	if (memorySession && peers) {
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
							"[Clairvoyant] Fetching memory context for weather personalization",
						);
						const contextData = (await memorySession.getContext({
							peerTarget: diatribePeer.id,
							lastUserMessage: "weather",
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

						// Extract weather-relevant deductive conclusions (e.g., preferences about weather)
						const weatherRelatedDeductions = peerRep.deductive
							.map((d) => d.conclusion)
							.filter(
								(conclusion: string) =>
									conclusion.toLowerCase().includes("weather") ||
									conclusion.toLowerCase().includes("cold") ||
									conclusion.toLowerCase().includes("hot") ||
									conclusion.toLowerCase().includes("rain") ||
									conclusion.toLowerCase().includes("sun"),
							)
							.slice(0, 2); // Limit to top 2 relevant deductions

						// Extract recent weather queries with timestamps
						const recentMessages = contextData.messages || [];
						const weatherPattern =
							/weather|temperature|forecast|rain|snow|sun|cold|hot/i;
						const recentWeatherQueries = recentMessages
							.filter((msg) => weatherPattern.test(msg.content))
							.slice(-5) // Get last 5 weather-related messages
							.map((msg) => {
								if (msg.metadata?.timestamp) {
									const timeAgo = getTimeAgo(msg.metadata.timestamp);
									return `Asked about weather "${msg.content.slice(0, 40)}${msg.content.length > 40 ? "..." : ""}" ${timeAgo}`;
								}
								return null;
							})
							.filter(Boolean) as string[];

						// Combine deductions with temporal information
						const deductionsWithTiming = weatherRelatedDeductions.concat(
							recentWeatherQueries.slice(0, 1), // Add up to 1 recent weather query timestamp
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
	}

	const weatherLines = await b.SummarizeWeatherFormatted(
		response,
		preferredUnit,
		memoryContext,
	);

	for (let i = 0; i < weatherLines.lines.length; i++) {
		const line = weatherLines.lines[i];

		if (weatherRunIds.get(session) !== runId) return;

		session.logger.info(`[Clairvoyant] Weather: ${line}`);
		displayQueue.enqueue({
			text: `// Clairvoyant\nW: ${line}`,
			prefix: "W",
			durationMs: 3000,
			priority: 2,
		});
	}

	if (logContext && weatherLines.lines.length > 0) {
		const responseText = weatherLines.lines.map((l) => `W: ${l}`).join("\n");
		updateConversationResponse(
			logContext.convexUserId,
			logContext.sessionId,
			logContext.transcript,
			responseText,
		);
	}
}

export async function startWeatherFlow(
	session: AppSession,
	memorySession: Session | undefined,
	peers: Peer[] | undefined,
	displayQueue: DisplayQueueManager,
	logContext?: { convexUserId: Id<"users">; sessionId: string; transcript: string },
) {
	const mentraUserId = session.userId;
	let preferredUnit: "C" | "F" = "C";

	try {
		const prefs = await getUserPreferences(mentraUserId);
		preferredUnit = (prefs.weatherUnit as "C" | "F") || "C";
		session.logger.info(
			`[Clairvoyant] User preference: weatherUnit=${preferredUnit}`,
		);
	} catch (error) {
		session.logger.warn(
			`[Clairvoyant] Failed to fetch preferences, using default (C): ${String(error)}`,
		);
	}
	displayQueue.enqueue({
		text: "// Clairvoyant\nW: Looking outside...",
		prefix: "W",
		durationMs: 2000,
		priority: 1,
	});

	const runId = Date.now();
	weatherRunIds.set(session, runId);

	let locationReceived = false;

	const unsubscribe = session.events.onLocation(async (location) => {
		if (weatherRunIds.get(session) !== runId) {
			session.logger.info(
				`[Clairvoyant] Ignoring stale location callback (runId: ${runId})`,
			);
			return;
		}

		if (locationReceived) return;
		locationReceived = true;

		try {
			unsubscribe?.();

			session.logger.info(
				`[Clairvoyant] Location received: ${location.lat}, ${location.lng}`,
			);

			// Update the user's current location in Convex (fire and forget)
			void setCurrentLocation(mentraUserId, {
				lat: location.lat,
				lng: location.lng,
			});

			// Use the helper function to show "Getting the weather..." during the API call
			const response = await showTextDuringOperation(
				session,
				displayQueue,
				"// Clairvoyant\nW: Getting the weather...",
				"// Clairvoyant\nW: Got the weather!",
				"// Clairvoyant\nW: Couldn't get the weather.",
				() => getWeatherData(location.lat, location.lng, preferredUnit),
				{ prefix: "W", durationMs: 2000 },
			);

			if (!response) {
				throw new Error("No weather response");
			}

			if (weatherRunIds.get(session) !== runId) {
				session.logger.info(
					`[Clairvoyant] Weather response arrived for stale request, discarding`,
				);
				return;
			}

			await processWeatherData(
				session,
				mentraUserId,
				response,
				preferredUnit,
				runId,
				displayQueue,
				memorySession,
				peers,
				logContext,
			);

			// TODO: Add a BAML to check if the weather is inclement and if so and if so, ask the user if they're appropriately dressed for the weather.
			// TODO: Add a memory call to intercept the users' answer and add it to the memory.
		} catch (err) {
			session.logger.error(`[Clairvoyant] Weather flow error: ${String(err)}`);

			if (weatherRunIds.get(session) === runId) {
				displayQueue.enqueue({
					text: "// Clairvoyant\nW: Couldn't figure out the weather.",
					prefix: "W",
					durationMs: 2000,
					priority: 2,
				});
			}
		}
	});

	const TIMEOUT_MS = 6000;

	setTimeout(async () => {
		if (weatherRunIds.get(session) !== runId) return;

		if (!locationReceived) {
			session.logger.warn(
				`[Clairvoyant] Location timeout after ${TIMEOUT_MS}ms`,
			);

			unsubscribe?.();

			// Try to use default location from preferences (geocoded billing address)
			session.logger.info(
				"[Clairvoyant] Attempting to use default location from preferences",
			);

			const defaultLocation = await getDefaultLocation(mentraUserId);

			if (defaultLocation) {
				session.logger.info(
					`[Clairvoyant] Using default location: ${defaultLocation.lat}, ${defaultLocation.lng}`,
				);

				locationReceived = true; // Prevent further timeout messages

				displayQueue.enqueue({
					text: "// Clairvoyant\nW: Using your billing location…",
					prefix: "W",
					durationMs: 2000,
					priority: 1,
				});

				try {
					const response = await showTextDuringOperation(
						session,
						displayQueue,
						"// Clairvoyant\nW: Getting the weather...",
						"// Clairvoyant\nW: Got the weather!",
						"// Clairvoyant\nW: Couldn't get the weather.",
						() =>
							getWeatherData(
								defaultLocation.lat,
								defaultLocation.lng,
								preferredUnit,
							),
						{ prefix: "W", durationMs: 2000 },
					);

					if (!response) {
						throw new Error("No weather response");
					}

					if (weatherRunIds.get(session) !== runId) {
						session.logger.info(
							`[Clairvoyant] Weather response arrived for stale request, discarding`,
						);
						return;
					}

					await processWeatherData(
						session,
						mentraUserId,
						response,
						preferredUnit,
						runId,
						displayQueue,
						memorySession,
						peers,
						logContext,
					);
				} catch (err) {
					session.logger.error(
						`[Clairvoyant] Weather flow error with fallback location: ${String(err)}`,
					);

					if (weatherRunIds.get(session) === runId) {
						displayQueue.enqueue({
							text: "// Clairvoyant\nW: Couldn't figure out the weather.",
							prefix: "W",
							durationMs: 2000,
							priority: 2,
						});
					}
				}
			} else {
				// No default location available
				displayQueue.enqueue({
					text: "// Clairvoyant\nW: Still waiting on location…",
					prefix: "W",
					durationMs: 2000,
					priority: 1,
				});

				setTimeout(() => {
					if (weatherRunIds.get(session) === runId && !locationReceived) {
						displayQueue.enqueue({
							text: "// Clairvoyant\nW: Could not get your location.",
							prefix: "W",
							durationMs: 2000,
							priority: 2,
						});
					}
				}, 2000);
			}
		}
	}, TIMEOUT_MS);
}
