import { type AppSession, ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { showTextDuringOperation } from "../core/textWall";
import { getWeatherData } from "../tools/weatherCall";

const weatherRunIds = new WeakMap<AppSession, number>();

export async function startWeatherFlow(session: AppSession) {
	session.layouts.showTextWall("// Clairvoyant\nW: Looking outside...", {
		view: ViewType.MAIN,
		durationMs: 2000,
	});

	const runId = Date.now();
	weatherRunIds.set(session, runId);

	let locationReceived = false;
	let weatherTextWallShown = false;

	const unsubscribe = session.events.onLocation(async (location) => {
		if (weatherRunIds.get(session) !== runId) {
			session.logger.info(
				`[Clairvoyant] Ignoring stale location callback (runId: ${runId})`,
			);
			// Clear any lingering text wall from stale requests
			if (weatherTextWallShown) {
				session.layouts.showTextWall("", {
					view: ViewType.MAIN,
					durationMs: 500,
				});
			}
			return;
		}

		if (locationReceived) return;
		locationReceived = true;

		try {
			unsubscribe?.();

			session.logger.info(
				`[Clairvoyant] Location received: ${location.lat}, ${location.lng}`,
			);

			weatherTextWallShown = true;

			// Use the helper function to show "Getting the weather..." during the API call
			const response = await showTextDuringOperation(
				session,
				"// Clairvoyant\nW: Getting the weather...",
				"// Clairvoyant\nW: Got the weather!",
				"// Clairvoyant\nW: Couldn't get the weather.",
				() => getWeatherData(location.lat, location.lng),
			);

			weatherTextWallShown = false;

			if (!response) {
				throw new Error("No weather response");
			}

			if (weatherRunIds.get(session) !== runId) {
				session.logger.info(
					`[Clairvoyant] Weather response arrived for stale request, discarding`,
				);
				return;
			}

			const weatherLines = await b.SummarizeWeatherFormatted(response);

			for (let i = 0; i < weatherLines.lines.length; i++) {
				const line = weatherLines.lines[i];

				if (weatherRunIds.get(session) !== runId) return;

				session.logger.info(`[Clairvoyant] Weather: ${line}`);
				session.layouts.showTextWall(`// Clairvoyant\nW: ${line}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});

				if (i < weatherLines.lines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}

			// TODO: Add a BAML to check if the weather is inclement and if so and if so, ask the user if they're appropriately dressed for the weather.
			// TODO: Add a memory call to intercept the users' answer and add it to the memory.
		} catch (err) {
			weatherTextWallShown = false;
			session.logger.error(`[Clairvoyant] Weather flow error: ${String(err)}`);

			if (weatherRunIds.get(session) === runId) {
				session.layouts.showTextWall(
					"// Clairvoyant\nW: Couldn't figure out the weather.",
					{
						view: ViewType.MAIN,
						durationMs: 2000,
					},
				);
			}
		}
	});

	const TIMEOUT_MS = 6000;

	setTimeout(() => {
		if (weatherRunIds.get(session) !== runId) return;

		if (!locationReceived) {
			session.logger.warn(
				`[Clairvoyant] Location timeout after ${TIMEOUT_MS}ms`,
			);

			unsubscribe?.();

			if (weatherTextWallShown) {
				session.layouts.showTextWall("", {
					view: ViewType.MAIN,
					durationMs: 500,
				});
			}

			session.layouts.showTextWall(
				"// Clairvoyant\nW: Still waiting on location…",
				{
					view: ViewType.MAIN,
					durationMs: 2000,
				},
			);

			setTimeout(() => {
				if (weatherRunIds.get(session) === runId && !locationReceived) {
					session.layouts.showTextWall(
						"// Clairvoyant\nW: Could not get your location.",
						{
							view: ViewType.MAIN,
							durationMs: 2000,
						},
					);
				}
			}, 2000);
		}
	}, TIMEOUT_MS);
}
