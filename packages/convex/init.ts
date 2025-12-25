import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/**
 * Initialization script to run on deploy.
 * Registers all cron jobs idempotently.
 *
 * Run with: npx convex dev --run init
 * Or: npx convex run init
 */
export default internalMutation({
	args: {},
	handler: async (ctx): Promise<void> => {
		console.log("[Init] Running initialization...");

		// Register the daily summary cron job
		await ctx.runMutation(internal.cronManagement.registerDailyCron, {});

		console.log("[Init] Initialization complete.");
	},
});
