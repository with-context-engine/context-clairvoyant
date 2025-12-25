import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { resend } from "./resendClient";
import { polar } from "./payments";

const http = httpRouter();

polar.registerRoutes(http, {
	path: "/polar/events",
	onSubscriptionCreated: async (ctx, event) => {
		const metadataUserId = event.data.customer?.metadata?.userId;
		const userId =
			event.data.customer?.externalId ??
			(metadataUserId ? String(metadataUserId) : undefined);
		const customerId = event.data.customer?.id;

		if (!userId) {
			console.warn(
				"[Polar Webhook] No externalId or metadata.userId found on customer for subscription.created event",
			);
			return;
		}

		console.log(
			`[Polar Webhook] Subscription created for user ${userId}, customer ${customerId}`,
		);

		await ctx.runMutation(
			internal.payments.scheduleSubscriptionCreatedHandler,
			{
				userId,
				customerId: customerId ?? null,
			},
		);
	},
});

http.route({
	path: "/notes/webhook",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		return await resend.handleResendEventWebhook(ctx, req);
	}),
});

export default http;
