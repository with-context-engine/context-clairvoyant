import { b, Router } from "@clairvoyant/baml-client";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { AppSession } from "@mentra/sdk";
import {
	checkUserIsPro,
	convexClient,
	recordToolInvocation,
} from "../core/convex";
import type { DisplayQueueManager } from "../core/displayQueue";

const followUpRunIds = new WeakMap<AppSession, number>();

/**
 * Starts the "follow up" flow - saves the current context for later follow-up.
 *
 * @param session - The AppSession for displaying text walls
 * @param mentraUserId - The user's Mentra ID (for analytics)
 * @param userId - The user's Convex ID
 * @param sessionId - The current session ID
 * @param displayQueue - The DisplayQueueManager for queueing messages
 */
export async function startFollowUpFlow(
	session: AppSession,
	mentraUserId: string,
	userId: Id<"users">,
	sessionId: string,
	displayQueue: DisplayQueueManager,
) {
	const runId = Date.now();
	followUpRunIds.set(session, runId);

	session.logger.info("[Clairvoyant] Follow Up: starting flow");

	displayQueue.enqueue({
		text: "// Clairvoyant\nF: Saving for follow-up...",
		prefix: "F",
		durationMs: 3000,
		priority: 1,
	});

	try {
		const isPro = await checkUserIsPro(mentraUserId);
		if (!isPro) {
			if (followUpRunIds.get(session) !== runId) return;
			session.logger.info(
				"[Clairvoyant] Follow Up: user is not Pro, skipping",
			);
			displayQueue.enqueue({
				text: "// Clairvoyant\nF: Upgrade to Pro for follow-ups.",
				prefix: "F",
				durationMs: 3000,
				priority: 1,
			});
			return;
		}

		void recordToolInvocation(mentraUserId, Router.FOLLOW_UP);

		const recentMessages = await convexClient.query(
			api.displayQueue.getRecentByUser,
			{ userId, limit: 5 },
		);

		if (followUpRunIds.get(session) !== runId) return;

		const displayedMessages = recentMessages
			.filter((msg) => msg.status === "displayed")
			.map((msg) => msg.message);

		if (displayedMessages.length === 0) {
			displayQueue.enqueue({
				text: "// Clairvoyant\nF: Nothing to follow up on.",
				prefix: "F",
				durationMs: 3000,
				priority: 2,
			});
			return;
		}

		const followupTopic = await b.ExtractFollowupTopic(
			"follow up on this",
			displayedMessages,
		);

		if (followUpRunIds.get(session) !== runId) return;

		await convexClient.mutation(api.followups.create, {
			userId,
			sessionId,
			topic: followupTopic.topic,
			summary: followupTopic.summary,
			sourceMessages: displayedMessages,
		});

		if (followUpRunIds.get(session) !== runId) return;

		const truncatedTopic =
			followupTopic.topic.length > 20
				? `${followupTopic.topic.slice(0, 20)}...`
				: followupTopic.topic;

		session.logger.info(
			`[Clairvoyant] Follow Up: saved "${followupTopic.topic}"`,
		);
		displayQueue.enqueue({
			text: `// Clairvoyant\nF: Saved: ${truncatedTopic}`,
			prefix: "F",
			durationMs: 3000,
			priority: 2,
		});
	} catch (error) {
		session.logger.error(`[Clairvoyant] Follow Up: error - ${String(error)}`);

		if (followUpRunIds.get(session) === runId) {
			displayQueue.enqueue({
				text: "// Clairvoyant\nF: Something went wrong.",
				prefix: "F",
				durationMs: 3000,
				priority: 2,
			});
		}
	}
}
