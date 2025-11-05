import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { checkUserIsPro } from "../core/convex";
import { showTextDuringOperation } from "../core/textWall";
import { performWebSearch } from "../tools/webSearch";
import { MemoryCapture } from "./memory";

const webSearchRunIds = new WeakMap<AppSession, number>();

export async function startWebSearchFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
) {
	const runId = Date.now();
	webSearchRunIds.set(session, runId);

	session.logger.info(
		`[startWebSearchFlow] Starting web search flow for query: ${query}`,
	);

	const isPro = await checkUserIsPro(session.userId);
	if (!isPro) {
		session.logger.warn(
			"[startWebSearchFlow] User is not Pro, web search disabled",
		);
		session.layouts.showTextWall(
			"// Clairvoyant\nS: Web search is a Pro feature.",
			{
				view: ViewType.MAIN,
				durationMs: 3000,
			},
		);
		return;
	}

	try {
		const searchResults = await showTextDuringOperation(
			session,
			"// Clairvoyant\nS: Searching the web...",
			"// Clairvoyant\nS: Found it!",
			"// Clairvoyant\nS: Couldn't search the web.",
			() => performWebSearch(query),
		);

		await MemoryCapture(query, session, memorySession, peers, "diatribe");

		if (!searchResults) {
			throw new Error("No response from web search");
		}

		if (webSearchRunIds.get(session) !== runId) {
			session.logger.info(
				`[startWebSearchFlow] Web search response arrived for stale request, discarding`,
			);
			return;
		}

		const answerLines = await b.AnswerSearch(query, searchResults);

		if (answerLines.results[0]?.lines?.length) {
			await MemoryCapture(
				answerLines.results[0]?.lines?.join("\n"),
				session,
				memorySession,
				peers,
				"synthesis",
			);
		}

		if (webSearchRunIds.get(session) !== runId) {
			session.logger.info(
				`[startWebSearchFlow] Web search response arrived for stale request, discarding`,
			);
			return;
		}

		const lines = answerLines.results[0]?.lines;

		if (lines?.length) {
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (webSearchRunIds.get(session) !== runId) return;
				session.logger.info(`[startWebSearchFlow] Web search result: ${line}`);
				session.layouts.showTextWall(`// Clairvoyant\nS: ${line}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});
				if (i < lines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}
		} else {
			session.logger.error(`[startWebSearchFlow] No lines in answerLines`);
		}
	} catch (error) {
		session.logger.error(
			`[startWebSearchFlow] Web search flow error: ${String(error)}`,
		);

		if (webSearchRunIds.get(session) === runId) {
			session.layouts.showTextWall(
				"// Clairvoyant\nS: Couldn't search the web.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
		}
	}
}
