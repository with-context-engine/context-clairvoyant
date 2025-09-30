import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { showTextDuringOperation } from "../core/textWall";
import { getPlaces } from "../tools/mapsCall";
import { MemoryCapture } from "./memory";

const mapsRunIds = new WeakMap<AppSession, number>();

export async function startMapsFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
) {
	const runId = Date.now();
	mapsRunIds.set(session, runId);

	session.layouts.showTextWall("// Clairvoyant\nM: Checking nearby spots...", {
		view: ViewType.MAIN,
		durationMs: 2000,
	});

	let locationReceived = false;
	let statusWallActive = false;

	const unsubscribe = session.events.onLocation(async (location) => {
		if (mapsRunIds.get(session) !== runId) {
			session.logger.info(
				`[startMapsFlow] Ignoring stale location callback (runId: ${runId})`,
			);
			if (statusWallActive) {
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
				`[startMapsFlow] Location received: ${location.lat}, ${location.lng}`,
			);

			statusWallActive = true;

			const places = await showTextDuringOperation(
				session,
				"// Clairvoyant\nM: Finding nearby matches...",
				"// Clairvoyant\nM: Found a few ideas!",
				"// Clairvoyant\nM: Couldn't find anything nearby.",
				() =>
					getPlaces(query, {
						latitude: location.lat,
						longitude: location.lng,
					}),
			);

			await MemoryCapture(query, session, memorySession, peers, "diatribe");

			statusWallActive = false;

			if (mapsRunIds.get(session) !== runId) {
				session.logger.info(
					`[startMapsFlow] Places response arrived for stale request, discarding`,
				);
				return;
			}

			if (!places?.length) {
				session.layouts.showTextWall(
					"// Clairvoyant\nW: No nearby matches right now.",
					{
						view: ViewType.MAIN,
						durationMs: 3000,
					},
				);
				return;
			}

			const topPlaces = places.slice(0, 3);
			const placeLines = await b.SummarizePlaces(query, topPlaces);
			const lines = placeLines.lines;

			if (!lines?.length) {
				session.logger.warn(
					"[startMapsFlow] SummarizePlaces returned no lines",
				);
				session.layouts.showTextWall(
					"// Clairvoyant\nM: Couldn't summarize those spots.",
					{
						view: ViewType.MAIN,
						durationMs: 3000,
					},
				);
				return;
			}

			await MemoryCapture(
				lines.join("\n"),
				session,
				memorySession,
				peers,
				"synthesis",
			);

			for (let i = 0; i < lines.length; i++) {
				if (mapsRunIds.get(session) !== runId) return;

				const line = lines[i];
				session.logger.info(`[startMapsFlow] Map result: ${line}`);
				session.layouts.showTextWall(`// Clairvoyant\nM: ${line}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});

				if (i < lines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}
		} catch (error) {
			statusWallActive = false;
			session.logger.error(`[startMapsFlow] Maps flow error: ${String(error)}`);

			if (mapsRunIds.get(session) === runId) {
				session.layouts.showTextWall(
					"// Clairvoyant\nW: Couldn't explore nearby spots.",
					{
						view: ViewType.MAIN,
						durationMs: 3000,
					},
				);
			}
		}
	});

	const TIMEOUT_MS = 6000;

	setTimeout(() => {
		if (mapsRunIds.get(session) !== runId) return;
		if (locationReceived) return;

		session.logger.warn(
			`[startMapsFlow] Location timeout after ${TIMEOUT_MS}ms`,
		);

		unsubscribe?.();

		if (statusWallActive) {
			session.layouts.showTextWall("", {
				view: ViewType.MAIN,
				durationMs: 500,
			});
		}

		session.layouts.showTextWall(
			"// Clairvoyant\nM: Still waiting on your location…",
			{
				view: ViewType.MAIN,
				durationMs: 2000,
			},
		);

		setTimeout(() => {
			if (mapsRunIds.get(session) !== runId) return;
			if (locationReceived) return;

			session.layouts.showTextWall(
				"// Clairvoyant\nM: Couldn't get your location.",
				{
					view: ViewType.MAIN,
					durationMs: 2000,
				},
			);
		}, 2000);
	}, TIMEOUT_MS);
}
