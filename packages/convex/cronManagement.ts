import { Crons } from "@convex-dev/crons";
import { components, internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

// Initialize the crons component
const crons = new Crons(components.crons);

/**
 * Register the daily cron job. Call this from an init script or manually.
 * Uses idempotent registration with a name so it can be called multiple times.
 */
export const registerDailyCron = internalMutation({
	args: {},
	handler: async (ctx): Promise<{ registered: boolean; cronId?: string }> => {
		const cronName = "daily-summary-synthesis";

		// Check if already registered
		const existing = await crons.get(ctx, { name: cronName });
		if (existing !== null) {
			console.log(`[Cron] Daily cron already registered: ${cronName}`);
			return { registered: false, cronId: existing.id };
		}

		// Register cron to run at 3:00 AM UTC daily
		// Cronspec: minute hour day-of-month month day-of-week
		const cronId = await crons.register(
			ctx,
			{ kind: "cron", cronspec: "0 3 * * *" },
			internal.dailySynthesis.runDailySynthesisForAllUsers,
			{},
			cronName,
		);

		console.log(`[Cron] Registered daily cron job: ${cronName} (${cronId})`);
		return { registered: true, cronId };
	},
});

/**
 * Unregister the daily cron job if needed.
 */
export const unregisterDailyCron = internalMutation({
	args: {},
	handler: async (ctx): Promise<{ unregistered: boolean }> => {
		const cronName = "daily-summary-synthesis";

		const existing = await crons.get(ctx, { name: cronName });
		if (existing === null) {
			console.log(`[Cron] No cron found with name: ${cronName}`);
			return { unregistered: false };
		}

		await crons.delete(ctx, { name: cronName });
		console.log(`[Cron] Unregistered daily cron job: ${cronName}`);
		return { unregistered: true };
	},
});

/**
 * List all registered cron jobs.
 */
export const listCrons = internalMutation({
	args: {},
	handler: async (ctx) => {
		return await crons.list(ctx);
	},
});
