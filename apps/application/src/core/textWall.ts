import type { AppSession } from "@mentra/sdk";
import type { DisplayQueueManager } from "./displayQueue";

/**
 * Shows a the user a message on AR glasses during an async operation,
 * then clears it when the operation completes or fails.
 *
 * Uses the DisplayQueueManager to prevent message conflicts.
 */
export async function showTextDuringOperation<T>(
	session: AppSession,
	displayQueue: DisplayQueueManager,
	loadingText: string,
	doneText: string,
	errorText: string,
	asyncOperation: () => Promise<T>,
	options: {
		prefix?: string;
		durationMs?: number;
	} = {},
): Promise<T> {
	const { prefix = "W", durationMs = 3000 } = options;

	const loadingId = displayQueue.showLoading(loadingText, prefix);

	try {
		const result = await asyncOperation();

		displayQueue.replaceLoading(loadingId, {
			text: doneText,
			prefix,
			durationMs,
			priority: 2,
		});

		return result;
	} catch (error) {
		displayQueue.replaceLoading(loadingId, {
			text: errorText,
			prefix,
			durationMs,
			priority: 2,
		});
		throw error;
	}
}
