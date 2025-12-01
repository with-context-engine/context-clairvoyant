import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { polar } from "./payments";

const http = httpRouter();

polar.registerRoutes(http, {
	path: "/polar/events",
	onSubscriptionCreated: async (ctx, event) => {
		// Handle new subscriptions - capture billing info and store in Honcho
		const userId = event.data.customer?.externalId;
		const customerId = event.data.customer?.id;

		if (!userId) {
			console.warn(
				"[Polar Webhook] No externalId found on customer for subscription.created event",
			);
			return;
		}

		console.log(
			`[Polar Webhook] Subscription created for user ${userId}, customer ${customerId}`,
		);

		// Schedule the action via internal mutation since webhook callbacks run in mutation context
		await ctx.runMutation(internal.payments.scheduleSubscriptionCreatedHandler, {
			userId,
			customerId: customerId ?? null,
		});
	},
});

export default http;
