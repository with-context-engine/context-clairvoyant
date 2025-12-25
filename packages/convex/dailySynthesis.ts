"use node";

import { Honcho } from "@honcho-ai/sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

// Type for session summary from the query
interface SessionSummary {
	honchoSessionId: string;
	summary: string;
	topics: string[];
	startedAt: string;
	endedAt: string;
}

/**
 * Synthesizes a daily summary from all session summaries for a given user and date.
 * Called by the daily cron job or manually for backfill.
 */
export const synthesizeDailySummary = internalAction({
	args: {
		userId: v.id("users"),
		date: v.string(), // "2024-12-21"
	},
	handler: async (
		ctx,
		{ userId, date },
	): Promise<{
		success: boolean;
		reason?: string;
		summary?: string;
		error?: string;
	}> => {
		// 1. Fetch session summaries for that date
		const sessions: SessionSummary[] = await ctx.runQuery(
			internal.sessionSummaries.getByDateInternal,
			{ userId, date },
		);

		if (sessions.length === 0) {
			console.log(`[DailySummary] No sessions for user ${userId} on ${date}`);
			return { success: false, reason: "no_sessions" };
		}

		// 2. Check API keys
		const honchoKey = process.env.HONCHO_API_KEY;
		if (!honchoKey) {
			console.error(
				"[DailySummary] HONCHO_API_KEY environment variable is not set",
			);
			return { success: false, reason: "missing_honcho_key" };
		}

		// 3. Fetch peer card from Honcho for personalization
		let peerCard: string[] = [];
		try {
			const honchoClient = new Honcho({
				apiKey: honchoKey,
				workspaceId: "with-context",
			});

			const diatribePeer = await honchoClient.peer(`${userId}-diatribe`);
			const peerContext = await diatribePeer.chat(
				"Give me a brief profile of this user including their name, location, interests, and personality traits.",
			);
			if (typeof peerContext === "string" && peerContext) {
				peerCard = peerContext
					.split("\n")
					.filter((line: string) => line.trim());
			}
			console.log(
				`[DailySummary] Fetched peer card for user ${userId}: ${peerCard.length} facts`,
			);
		} catch (error) {
			console.warn(
				`[DailySummary] Could not fetch peer card for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		// Build session inputs for BAML
		const sessionInputs = sessions.map((s: SessionSummary, i: number) => ({
			index: i + 1,
			summary: s.summary,
		}));

		const userProfile =
			peerCard.length > 0 ? peerCard.join("\n") : undefined;

		try {
			// Call BAML action for summarization
			const result = await ctx.runAction(
				internal.bamlActions.summarizeDailySessions,
				{
					sessions: sessionInputs,
					userProfile,
				},
			);

			const summary: string = result.summary ?? "No summary available.";

			// 3. Merge topics from all sessions (deduplicated)
			const allTopics: string[] = [
				...new Set(sessions.flatMap((s: SessionSummary) => s.topics)),
			];

			// 4. Store daily summary
			await ctx.runMutation(internal.dailySummaries.upsertInternal, {
				userId,
				date,
				summary,
				topics: allTopics,
				sessionCount: sessions.length,
			});

			console.log(
				`[DailySummary] Created summary for user ${userId} on ${date}: ${summary}`,
			);
			return { success: true, summary };
		} catch (error) {
			console.error(
				`[DailySummary] Error synthesizing for user ${userId} on ${date}:`,
				error,
			);
			return {
				success: false,
				reason: "baml_error",
				error: error instanceof Error ? error.message : String(error),
			};
		}
	},
});

/**
 * Runs daily synthesis for all users who had sessions on a given date.
 * Called by the cron job.
 */
export const runDailySynthesisForAllUsers = internalAction({
	args: {},
	handler: async (
		ctx,
	): Promise<{
		date: string;
		processed: number;
		success?: number;
		errors?: number;
	}> => {
		// Calculate yesterday's date
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dateStr: string = yesterday.toISOString().split("T")[0] as string;

		console.log(`[Cron] Running daily synthesis for ${dateStr}`);

		// Get all users who had sessions yesterday
		const usersWithSessions: Id<"users">[] = await ctx.runQuery(
			internal.sessionSummaries.getUsersWithSessionsOnDate,
			{ date: dateStr },
		);

		if (usersWithSessions.length === 0) {
			console.log(`[Cron] No users had sessions on ${dateStr}`);
			return { processed: 0, date: dateStr };
		}

		let successCount = 0;
		let errorCount = 0;

		for (const userId of usersWithSessions) {
			try {
				const result = await ctx.runAction(
					internal.dailySynthesis.synthesizeDailySummary,
					{
						userId,
						date: dateStr,
					},
				);
				if (result.success) {
					successCount++;
				} else {
					errorCount++;
				}
			} catch (error) {
				console.error(
					`[Cron] Error processing user ${userId}:`,
					error instanceof Error ? error.message : String(error),
				);
				errorCount++;
			}
		}

		console.log(
			`[Cron] Processed ${usersWithSessions.length} users for ${dateStr}: ${successCount} success, ${errorCount} errors`,
		);

		return {
			date: dateStr,
			processed: usersWithSessions.length,
			success: successCount,
			errors: errorCount,
		};
	},
});

/**
 * Backfill daily summaries for a user.
 * Processes all unique dates from their session summaries.
 */
export const backfillForUser = internalAction({
	args: {
		userId: v.id("users"),
	},
	handler: async (
		ctx,
		{ userId },
	): Promise<{
		userId: Id<"users">;
		processed: number;
		success: number;
		errors: number;
	}> => {
		// Get all session summaries for this user
		const allSessions: SessionSummary[] = await ctx.runQuery(
			internal.sessionSummaries.getAllForUserInternal,
			{ userId },
		);

		if (allSessions.length === 0) {
			console.log(`[Backfill] No sessions found for user ${userId}`);
			return { userId, processed: 0, success: 0, errors: 0 };
		}

		// Extract unique dates
		const uniqueDates: string[] = [
			...new Set(
				allSessions.map(
					(s: SessionSummary) => s.startedAt.split("T")[0] as string,
				),
			),
		];

		console.log(
			`[Backfill] Processing ${uniqueDates.length} days for user ${userId}`,
		);

		let successCount = 0;
		let errorCount = 0;

		for (const date of uniqueDates) {
			try {
				const result = await ctx.runAction(
					internal.dailySynthesis.synthesizeDailySummary,
					{ userId, date },
				);
				if (result.success) {
					successCount++;
				} else {
					errorCount++;
				}
			} catch (error) {
				console.error(
					`[Backfill] Error processing date ${date} for user ${userId}:`,
					error instanceof Error ? error.message : String(error),
				);
				errorCount++;
			}
		}

		console.log(
			`[Backfill] Completed for user ${userId}: ${successCount} success, ${errorCount} errors`,
		);

		return {
			userId,
			processed: uniqueDates.length,
			success: successCount,
			errors: errorCount,
		};
	},
});
