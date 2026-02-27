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

/**
 * Updates the response field for a previously logged conversation.
 * Used by handlers to capture the final formatted response shown on glasses.
 * Uses fire-and-forget pattern - errors are logged but don't block.
 */
export function updateConversationResponse(
	userId: Id<"users">,
	sessionId: string,
	transcript: string,
	response: string,
): void {
	void convexClient
		.mutation(api.conversationLogs.updateResponse, {
			userId,
			sessionId,
			transcript,
			response,
		})
		.catch((error) => {
			console.error(
				"[ConversationLogger] Failed to update conversation response:",
				error,
			);
		});
}
