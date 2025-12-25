import { api } from "@convex/_generated/api";
import { type AppSession, ViewType } from "@mentra/sdk";
import { b } from "@clairvoyant/baml-client";
import { checkUserIsPro, convexClient, recordToolInvocation } from "../core/convex";
import { Router } from "@clairvoyant/baml-client";

const noteThisRunIds = new WeakMap<AppSession, number>();

/**
 * Starts the "note this" flow - abridges the current session transcript
 * and sends it as a formatted note to the user's email.
 *
 * @param transcriptBuffer - All utterances from the current session
 * @param session - The AppSession for displaying text walls
 * @param mentraUserId - The user's Mentra ID
 */
export async function startNoteThisFlow(
	transcriptBuffer: string[],
	session: AppSession,
	mentraUserId: string,
) {
	const runId = Date.now();
	noteThisRunIds.set(session, runId);

	session.logger.info(
		`[Clairvoyant] Note This: starting flow with ${transcriptBuffer.length} utterances`,
	);

	// Show initial loading state
	session.layouts.showTextWall("// Clairvoyant\nN: Creating your note...", {
		view: ViewType.MAIN,
		durationMs: 3000,
	});

	try {
		// Check if there's anything to note
		if (transcriptBuffer.length === 0) {
			if (noteThisRunIds.get(session) !== runId) return;
			session.layouts.showTextWall(
				"// Clairvoyant\nN: Nothing to note yet.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
			return;
		}

		// Pro gate: Note This is a Pro feature
		const isPro = await checkUserIsPro(mentraUserId);
		if (!isPro) {
			if (noteThisRunIds.get(session) !== runId) return;
			session.logger.info(
				`[Clairvoyant] Note This: user is not Pro, skipping`,
			);
			session.layouts.showTextWall(
				"// Clairvoyant\nN: Upgrade to Pro for notes.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
			return;
		}

		// Record tool invocation
		void recordToolInvocation(mentraUserId, Router.NOTE_THIS);

		// Abridge the transcript using BAML
		const noteContent = await b.AbridgeToNote(transcriptBuffer);

		if (noteThisRunIds.get(session) !== runId) return;

		session.logger.info(
			`[Clairvoyant] Note This: abridged to "${noteContent.title}"`,
		);

		// Update text wall to show we're sending
		session.layouts.showTextWall("// Clairvoyant\nN: Sending to your email...", {
			view: ViewType.MAIN,
			durationMs: 3000,
		});

		// Send via Convex action (async, non-blocking)
		const result = await convexClient.action(api.notes.sendNoteEmail, {
			mentraUserId,
			title: noteContent.title,
			summary: noteContent.summary,
			keyPoints: noteContent.keyPoints,
		});

		if (noteThisRunIds.get(session) !== runId) return;

		if (result.success) {
			session.logger.info(
				`[Clairvoyant] Note This: email sent successfully (id: ${result.emailId})`,
			);
			session.layouts.showTextWall("// Clairvoyant\nN: Note sent!", {
				view: ViewType.MAIN,
				durationMs: 3000,
			});
		} else {
			session.logger.warn(
				`[Clairvoyant] Note This: email failed - ${result.reason}`,
			);

			// Show appropriate error message based on reason
			let errorMessage = "Couldn't send the note.";
			if (result.reason === "no_email_configured") {
				errorMessage = "No email configured. Check settings.";
			} else if (result.reason === "user_not_found") {
				errorMessage = "User not found.";
			}

			session.layouts.showTextWall(`// Clairvoyant\nN: ${errorMessage}`, {
				view: ViewType.MAIN,
				durationMs: 3000,
			});
		}
	} catch (error) {
		session.logger.error(
			`[Clairvoyant] Note This: error - ${String(error)}`,
		);

		if (noteThisRunIds.get(session) === runId) {
			session.layouts.showTextWall(
				"// Clairvoyant\nN: Something went wrong.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
		}
	}
}
