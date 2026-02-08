import { b, HintCategory } from "@clairvoyant/baml-client";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { updateConversationResponse } from "../core/conversationLogger";
import { checkUserIsPro, convexClient } from "../core/convex";
import type { DisplayQueueManager } from "../core/displayQueue";

const hintRunIds = new WeakMap<AppSession, number>();

export async function tryPassthroughHint(
	text: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
	mentraUserId: string,
	displayQueue: DisplayQueueManager,
	logContext?: { convexUserId: Id<"users">; sessionId: string; transcript: string },
): Promise<void> {
	const runId = Date.now();
	hintRunIds.set(session, runId);

	session.logger.info(
		`[tryPassthroughHint] Evaluating hint eligibility for: "${text}"`,
	);

	try {
		// Phase 1: Quick classification - is this hintable or ambient?
		const eligibility = await b.ClassifyForHint(text);

		if (hintRunIds.get(session) !== runId) return;

		if (eligibility.category !== HintCategory.HINTABLE) {
			session.logger.info(
				`[tryPassthroughHint] Classified as AMBIENT, skipping hint check`,
			);
			return;
		}

		const topic = eligibility.topic;
		if (!topic) {
			session.logger.info(
				`[tryPassthroughHint] No topic extracted, skipping hint`,
			);
			return;
		}

		session.logger.info(
			`[tryPassthroughHint] HINTABLE with topic: "${topic}", checking memory...`,
		);

		// Pro gate: only Pro users get proactive hints
		const isPro = await checkUserIsPro(mentraUserId);
		if (!isPro) {
			session.logger.info(
				`[tryPassthroughHint] User is not Pro, skipping hint`,
			);
			return;
		}

		// Fetch user for peer lookup
		const user = await convexClient.query(
			api.payments.getCurrentUserWithSubscription,
			{ mentraUserId },
		);

		if (!user) {
			session.logger.warn(
				`[tryPassthroughHint] User not found for mentraUserId: ${mentraUserId}`,
			);
			return;
		}

		const userId = user._id;
		const diatribePeer = peers.find((peer) => peer.id === `${userId}-diatribe`);

		if (!diatribePeer) {
			session.logger.warn(`[tryPassthroughHint] Diatribe peer not found`);
			return;
		}

		// Phase 2: Query memory for relevant knowledge
		let memoryContext: {
			userName?: string;
			userFacts: string[];
			deductiveFacts: string[];
		} | null = null;

		try {
			const contextData = (await memorySession.getContext({
				peerTarget: diatribePeer.id,
				lastUserMessage: `${topic}: ${text}`,
			})) as {
				peerCard: string[];
				peerRepresentation: string;
			};

			if (hintRunIds.get(session) !== runId) return;

			let peerRep: {
				explicit: Array<{ content: string }>;
				deductive: Array<{ conclusion: string; premises: string[] }>;
			};
			try {
				peerRep = JSON.parse(contextData.peerRepresentation);
			} catch {
				peerRep = { explicit: [], deductive: [] };
			}

			const userName = contextData.peerCard
				.find((fact: string) => fact.startsWith("Name:"))
				?.replace("Name:", "")
				.trim();

			// Get facts relevant to the topic (top 5)
			const relevantFacts = peerRep.explicit.map((e) => e.content).slice(0, 5);

			const relevantDeductions = peerRep.deductive
				.map((d) => d.conclusion)
				.slice(0, 3);

			memoryContext = {
				userName,
				userFacts: relevantFacts,
				deductiveFacts: relevantDeductions,
			};

			session.logger.info(
				`[tryPassthroughHint] Memory context fetched: ${relevantFacts.length} facts, ${relevantDeductions.length} deductions`,
			);
		} catch (error) {
			session.logger.warn(
				`[tryPassthroughHint] Failed to fetch memory: ${String(error)}`,
			);
			return;
		}

		// Phase 3: Generate hint if relevant knowledge exists
		if (
			memoryContext.userFacts.length === 0 &&
			memoryContext.deductiveFacts.length === 0
		) {
			session.logger.info(
				`[tryPassthroughHint] No stored knowledge to hint from`,
			);
			return;
		}

		const hintResult = await b.GenerateHint(topic, text, memoryContext);

		if (hintRunIds.get(session) !== runId) return;

		if (!hintResult.should_show || !hintResult.hint) {
			session.logger.info(`[tryPassthroughHint] LLM decided not to show hint`);
			return;
		}

		// Show the hint via displayQueue
		session.logger.info(
			`[tryPassthroughHint] Showing hint: "${hintResult.hint}"`,
		);
		displayQueue.enqueue({
			text: `// Clairvoyant\nH: ${hintResult.hint}`,
			prefix: "H",
			durationMs: 4000,
			priority: 3,
		});

		// Log the hint response for ML training
		if (logContext) {
			updateConversationResponse(
				logContext.convexUserId,
				logContext.sessionId,
				logContext.transcript,
				`H: ${hintResult.hint}`,
			);
		}
	} catch (error) {
		session.logger.error(`[tryPassthroughHint] Error: ${String(error)}`);
	}
}
