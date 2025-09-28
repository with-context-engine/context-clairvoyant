import type { Peer, Session } from "@honcho-ai/sdk";
import type { AppSession } from "@mentra/sdk";
import { ViewType } from "@mentra/sdk";
import { b } from "../baml_client";
import { showTextDuringOperation } from "../core/textWall";
import { MemoryCapture } from "./memory";

const knowledgeRunIds = new WeakMap<AppSession, number>();

export async function startKnowledgeFlow(
	query: string,
	session: AppSession,
	memorySession: Session,
	peers: Peer[],
) {
	const runId = Date.now();
	knowledgeRunIds.set(session, runId);

	session.logger.info(
		`[startKnowledgeFlow] Starting knowledge flow for query: ${query}`,
	);

	try {
		const response = await showTextDuringOperation(
			session,
			"",
			"",
			"",
			() => b.AnswerQuestion(query),
			{ view: ViewType.MAIN, clearDurationMs: 2000 },
		);

		await MemoryCapture(query, session, memorySession, peers);

		if (knowledgeRunIds.get(session) !== runId) {
			session.logger.info(
				`[startKnowledgeFlow] Answer arrived for stale request, discarding`,
			);
			return;
		}

		if (response.has_question) {
			const questionLine = response.question ? `${response.question}` : "";

			const answerLines = Array.isArray(response.answer)
				? response.answer
				: response.answer
					? [response.answer as unknown as string]
					: [];

			if (answerLines.length === 0) {
				session.logger.warn(
					"[startKnowledgeFlow] AnswerQuestion returned no answer lines",
				);
				session.layouts.showTextWall(`// Clairvoyant\nK: ${questionLine}`, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});
				return;
			}

			for (let i = 0; i < answerLines.length; i++) {
				if (knowledgeRunIds.get(session) !== runId) return;

				const answerLabel = answerLines.length > 1 ? `A${i + 1}` : "A";
				const answerLine = `${answerLabel}: ${answerLines[i]}`;
				session.logger.info(
					`[startKnowledgeFlow] Knowledge line: ${answerLine}`,
				);

				const wallText = `// Clairvoyant\nQ: ${questionLine}\n${answerLine}`;
				session.layouts.showTextWall(wallText, {
					view: ViewType.MAIN,
					durationMs: 3000,
				});

				if (i < answerLines.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			}
		} else {
			session.layouts.showTextWall("", {
				view: ViewType.MAIN,
				durationMs: 2000,
			});
		}
	} catch (error) {
		session.logger.error(
			`[startKnowledgeFlow] Knowledge flow error: ${String(error)}`,
		);

		if (knowledgeRunIds.get(session) === runId) {
			session.layouts.showTextWall(
				"// Clairvoyant\nK: Couldn't figure that out.",
				{
					view: ViewType.MAIN,
					durationMs: 3000,
				},
			);
		}
	}
}
