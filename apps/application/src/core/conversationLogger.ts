import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { convexClient } from "./convex";

/**
 * Logs a conversation to Convex for ML training data.
 * Uses fire-and-forget pattern - errors are logged but don't block.
 */
export function logConversation(
	userId: Id<"users">,
	sessionId: string,
	transcript: string,
	route: string,
	response?: string,
): void {
	void convexClient
		.mutation(api.conversationLogs.logConversation, {
			userId,
			sessionId,
			transcript,
			route,
			response,
		})
		.catch((error) => {
			console.error("[ConversationLogger] Failed to log conversation:", error);
		});
}
