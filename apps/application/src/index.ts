import { api } from "@convex/_generated/api";
import type { Session } from "@honcho-ai/sdk";
import { AppServer, type AppSession } from "@mentra/sdk";
import { b } from "./baml_client";
import { convexClient } from "./core/convex";
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
		const [memorySession, peers] = await initializeMemory(userId, sessionId);
		const transcriptBuffer: string[] = [];
		const startedAt = new Date().toISOString();

		const unsubscribe = session.events.onTranscription(async (data) => {
			if (
				!data.isFinal ||
				(data.duration && data.duration < MIN_AUDIO_DURATION_MS) ||
				this.questionRateLimiter.shouldSkip(session.logger, "Clairvoyant")
			) {
				return;
			}

			transcriptBuffer.push(data.text);
			await handleTranscription(data, session, memorySession, peers, userId);
		});

		this.sessionResources.set(sessionId, {
			unsubscribeTranscription: unsubscribe,
			memorySession,
			transcriptBuffer,
			startedAt,
			mentraUserId: userId,
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

			if (resources.transcriptBuffer.length > 0) {
				this.summarizeAndStoreSession(
					sessionId,
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
		sessionId: string,
		mentraUserId: string,
		transcripts: string[],
		startedAt: string,
	): Promise<void> {
		try {
			const result = await b.SummarizeSession(transcripts);
			const endedAt = new Date().toISOString();

			await convexClient.mutation(api.sessionSummaries.upsert, {
				mentraUserId,
				mentraSessionId: sessionId,
				summary: result.summary,
				topics: result.topics,
				startedAt,
				endedAt,
			});

			console.log(
				`[Clairvoyant] Stored session summary for ${sessionId}: ${result.summary}`,
			);
		} catch (error) {
			console.error(
				`[Clairvoyant] Error summarizing session ${sessionId}:`,
				error,
			);
		}
	}
}

const app = new Clairvoyant();
app.start().catch(console.error);
