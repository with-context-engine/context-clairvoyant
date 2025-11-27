import { type AppSession, ViewType } from "@mentra/sdk";

/**
 * Shows a the user a message on AR glasses during an async operation,
 * then clears it when the operation completes or fails.
 */
export async function showTextDuringOperation<T>(
	session: AppSession,
	loadingText: string,
	doneText: string,
	errorText: string,
	asyncOperation: () => Promise<T>,
	options: {
		view?: ViewType;
		clearDurationMs?: number;
	} = {},
): Promise<T> {
	const { view = ViewType.MAIN, clearDurationMs = 5000 } = options;

	session.layouts.showTextWall(loadingText, {
		view,
		durationMs: 30000,
	});

	try {
		const result = await asyncOperation();

		session.layouts.showTextWall(doneText, {
			view,
			durationMs: clearDurationMs,
		});

		return result;
	} catch (error) {
		session.layouts.showTextWall(errorText, {
			view,
			durationMs: clearDurationMs,
		});
		throw error;
	}
}
