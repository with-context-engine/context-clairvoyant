import { b } from "@clairvoyant/baml-client";
import { api } from "@convex/_generated/api";
import type { Session } from "@honcho-ai/sdk";
import { AppServer, type AppSession } from "@mentra/sdk";
import {
	checkUserIsPro,
	convexClient,
	getUserPreferences,
} from "./core/convex";
import { DisplayQueueManager } from "./core/displayQueue";
import { env } from "./core/env";
import { RateLimiter } from "./core/rateLimiting";
import { initializeMemory } from "./tools/memoryCall";
import { handleTranscription } from "./transcriptionFlow";

const PACKAGE_NAME = env.PACKAGE_NAME;
const MENTRAOS_API_KEY = env.MENTRAOS_API_KEY;
const PORT = env.PORT;
const MIN_AUDIO_DURATION_MS = 200;

interface SessionResources {
	unsubscribeTranscription: () => void;
	memorySession: Session;
	transcriptBuffer: string[];
	startedAt: string;
	mentraUserId: string;
	honchoSessionId: string;
	displayQueue: DisplayQueueManager;
}

class Clairvoyant extends AppServer {
	private questionRateLimiter: RateLimiter;
	private sessionResources: Map<string, SessionResources> = new Map();

	constructor() {
		super({
			packageName: PACKAGE_NAME,
			apiKey: MENTRAOS_API_KEY,
			port: PORT,
		});

		this.questionRateLimiter = new RateLimiter(1000);
	}

	protected override async onSession(
		session: AppSession,
		sessionId: string,
		userId: string,
	): Promise<void> {
		const [memorySession, peers, honchoSessionId] = await initializeMemory(
			userId,
			sessionId,
		);
		const transcriptBuffer: string[] = [];
		const startedAt = new Date().toISOString();
		const preferences = await getUserPreferences(userId);
		const displayQueue = new DisplayQueueManager(session, userId, sessionId, {
			prefixPriorities: preferences.prefixPriorities,
			gapSpeed: preferences.messageGapSpeed,
		});

		const unsubscribe = session.events.onTranscription(async (data) => {
			if (
				!data.isFinal ||
				(data.duration && data.duration < MIN_AUDIO_DURATION_MS) ||
				this.questionRateLimiter.shouldSkip(session.logger, "Clairvoyant")
			) {
				return;
			}

			transcriptBuffer.push(data.text);
			void handleTranscription(
				data,
				session,
				memorySession,
				peers,
				userId,
				transcriptBuffer,
				displayQueue,
			);
		});

		this.sessionResources.set(sessionId, {
			unsubscribeTranscription: unsubscribe,
			memorySession,
			transcriptBuffer,
			startedAt,
			mentraUserId: userId,
			honchoSessionId,
			displayQueue,
		});

		session.logger.info(
			`[Clairvoyant] Session started: ${sessionId} for user: ${userId}`,
		);
	}

	protected override async onStop(
		sessionId: string,
		userId: string,
		reason: string,
	): Promise<void> {
		const resources = this.sessionResources.get(sessionId);
		if (resources) {
			resources.unsubscribeTranscription();

			await resources.displayQueue.cancelAll();

			if (resources.transcriptBuffer.length > 0) {
				this.summarizeAndStoreSession(
					resources.honchoSessionId,
					resources.mentraUserId,
					resources.transcriptBuffer,
					resources.startedAt,
				).catch((error) => {
					console.error(
						`[Clairvoyant] Failed to summarize session ${sessionId}:`,
						error,
					);
				});
			}

			this.sessionResources.delete(sessionId);
		}

		console.log(
			`[Clairvoyant] Session ${sessionId} ended for user ${userId}: ${reason}`,
		);
	}

	private async summarizeAndStoreSession(
		honchoSessionId: string,
		mentraUserId: string,
		transcripts: string[],
		startedAt: string,
	): Promise<void> {
		// Pro gate: skip summarization for free users to save LLM tokens
		const isPro = await checkUserIsPro(mentraUserId);
		if (!isPro) {
			console.log(
				`[Clairvoyant] Skipping session summary for ${honchoSessionId}: user is not Pro`,
			);
			return;
		}

		try {
			const result = await b.SummarizeSession(transcripts);
			const endedAt = new Date().toISOString();

			await convexClient.mutation(api.sessionSummaries.upsert, {
				mentraUserId,
				honchoSessionId,
				summary: result.summary,
				topics: result.topics,
				startedAt,
				endedAt,
			});

			console.log(
				`[Clairvoyant] Stored session summary for ${honchoSessionId}: ${result.summary}`,
			);
		} catch (error) {
			console.error(
				`[Clairvoyant] Error summarizing session ${honchoSessionId}:`,
				error,
			);
		}
	}
}

const app = new Clairvoyant();
app.start().catch(console.error);
