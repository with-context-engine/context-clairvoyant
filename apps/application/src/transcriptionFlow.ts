import { b, Router } from "@clairvoyant/baml-client";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession, TranscriptionData } from "@mentra/sdk";
import { recordToolInvocation } from "./core/convex";
import type { DisplayQueueManager } from "./core/displayQueue";
import { tryPassthroughHint } from "./handlers/hints";
import { startKnowledgeFlow } from "./handlers/knowledge";
import { startMapsFlow } from "./handlers/maps";
import { MemoryCapture, MemoryRecall } from "./handlers/memory";
import { startFollowUpFlow } from "./handlers/followup";
import { startNoteThisFlow } from "./handlers/noteThis";
import { startWebSearchFlow } from "./handlers/search";
import { startWeatherFlow } from "./handlers/weather";

export async function handleTranscription(
	data: TranscriptionData,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
	sessionId: string,
	transcriptBuffer: string[],
	displayQueue: DisplayQueueManager,
) {
	session.logger.info(`[Clairvoyant] Transcription: ${data.text}`);
	const routing = await b.Route(data.text);
	if (!routing.routing) {
		session.logger.warn(`[Clairvoyant] No routing decision made. Resetting...`);
		return;
	}
	switch (routing.routing) {
		case Router.WEATHER:
			session.logger.info(`[Clairvoyant] Weather route: starting async flow`);
			void recordToolInvocation(mentraUserId, Router.WEATHER);
			void startWeatherFlow(session, memorySession, peers, displayQueue);
			return;

		case Router.MAPS:
			session.logger.info(`[Clairvoyant] Maps route: starting async flow`);
			void recordToolInvocation(mentraUserId, Router.MAPS);
			void startMapsFlow(
				data.text,
				session,
				memorySession,
				peers,
				mentraUserId,
				displayQueue,
			);
			return;

		case Router.WEB_SEARCH:
			session.logger.info(
				`[Clairvoyant] Web search route: starting async flow`,
			);
			void recordToolInvocation(mentraUserId, Router.WEB_SEARCH);
			void startWebSearchFlow(
				data.text,
				session,
				memorySession,
				peers,
				mentraUserId,
				displayQueue,
			);
			return;

		case Router.KNOWLEDGE:
			session.logger.info(`[Clairvoyant] Routing: Starting knowledge flow`);
			void recordToolInvocation(mentraUserId, Router.KNOWLEDGE);
			void startKnowledgeFlow(
				data.text,
				session,
				memorySession,
				peers,
				mentraUserId,
				displayQueue,
			);
			return;

		case Router.MEMORY_CAPTURE:
			session.logger.info(
				`[Clairvoyant] Memory Capture route: starting async flow`,
			);
			void MemoryCapture(
				data.text,
				session,
				memorySession,
				peers,
				"diatribe",
				mentraUserId,
				displayQueue,
			);
			return;

		case Router.MEMORY_RECALL:
			session.logger.info(
				`[Clairvoyant] Memory Recall route: starting async flow`,
			);
			void recordToolInvocation(mentraUserId, Router.MEMORY_RECALL);
			void MemoryRecall(data.text, session, memorySession, peers, mentraUserId, displayQueue);
			return;

		case Router.PASSTHROUGH:
			session.logger.info(
				`[Clairvoyant] Passthrough route: checking for proactive hints`,
			);
			void tryPassthroughHint(
				data.text,
				session,
				memorySession,
				peers,
				mentraUserId,
				displayQueue,
			);
			return;

		case Router.NOTE_THIS:
			session.logger.info(`[Clairvoyant] Note This route: starting async flow`);
			void startNoteThisFlow(transcriptBuffer, session, mentraUserId, displayQueue);
			return;

		case Router.FOLLOW_UP:
			session.logger.info(`[Clairvoyant] Follow Up route: starting async flow`);
			void startFollowUpFlow(session, mentraUserId, sessionId, displayQueue);
			return;

		default: {
			session.logger.info(
				`[Clairvoyant] Unknown route, defaulting to passthrough`,
			);
			return;
		}
	}
}
