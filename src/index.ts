import { AppServer, type AppSession } from "@mentra/sdk";
import { env } from "./application/core/env";
import { RateLimiter } from "./application/core/rateLimiting";
import { initializeMemory } from "./application/tools/memoryCall";
import { handleTranscription } from "./application/transcriptionFlow";

const PACKAGE_NAME = env.PACKAGE_NAME;
const MENTRAOS_API_KEY = env.MENTRAOS_API_KEY;
const PORT = env.PORT;

class Clairvoyant extends AppServer {
	private questionRateLimiter: RateLimiter;

	constructor() {
		super({
			packageName: PACKAGE_NAME,
			apiKey: MENTRAOS_API_KEY,
			port: PORT,
		});

		this.questionRateLimiter = new RateLimiter(1000);
	}

	protected override async onSession(session: AppSession): Promise<void> {
		const [memorySession, peers] = await initializeMemory();

		session.events.onTranscription(async (data) => {
			// If its not a final utterance, skip
			if (!data.isFinal) return;

			// If the audio segment causing this transcription is too short, skip
			if (data.duration) {
				if (data.duration < 200) {
					return;
				}
			}

			// If the question rate limiter is triggered, skip
			if (this.questionRateLimiter.shouldSkip(session.logger, "Clairvoyant")) {
				return;
			}

			// Handle the transcription
			await handleTranscription(data, session, memorySession, peers);
		});
	}
}

const app = new Clairvoyant();
app.start().catch(console.error);
