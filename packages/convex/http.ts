import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { polar } from "./payments";
import { resend } from "./resendClient";

const http = httpRouter();

polar.registerRoutes(http, {
	path: "/polar/events",
	onSubscriptionCreated: async (ctx, event) => {
		const metadataUserId = event.data.customer?.metadata?.userId;
		const userId =
			event.data.customer?.externalId ??
			(metadataUserId ? String(metadataUserId) : undefined);
		const customerId = event.data.customer?.id;
		const productId = event.data.productId;

		if (!userId) {
			console.warn(
				"[Polar Webhook] No externalId or metadata.userId found on customer for subscription.created event",
			);
			return;
		}

		console.log(
			`[Polar Webhook] Subscription created for user ${userId}, customer ${customerId}, product ${productId}`,
		);

		if (productId === polar.products.optOut) {
			await ctx.runMutation(internal.users.setOptOutStatus, {
				userId: userId as import("./_generated/dataModel").Id<"users">,
				optedOut: true,
			});
		}

		if (productId === polar.products.emailThreads) {
			await ctx.runMutation(internal.users.setPaidEmailThreadsStatus, {
				userId: userId as import("./_generated/dataModel").Id<"users">,
				paidEmailThreads: true,
			});
		}

		await ctx.runMutation(
			internal.payments.scheduleSubscriptionCreatedHandler,
			{
				userId,
				customerId: customerId ?? null,
			},
		);
	},
	onSubscriptionUpdated: async (ctx, event) => {
		const metadataUserId = event.data.customer?.metadata?.userId;
		const userId =
			event.data.customer?.externalId ??
			(metadataUserId ? String(metadataUserId) : undefined);
		if (!userId) {
			return;
		}

		const productId = event.data.productId;
		const endedStatuses = new Set([
			"canceled",
			"past_due",
			"unpaid",
			"revoked",
		]);
		const isActive = !endedStatuses.has(event.data.status);

		if (productId === polar.products.optOut) {
			await ctx.runMutation(internal.users.setOptOutStatus, {
				userId: userId as import("./_generated/dataModel").Id<"users">,
				optedOut: isActive,
			});
		}

		if (productId === polar.products.emailThreads) {
			await ctx.runMutation(internal.users.setPaidEmailThreadsStatus, {
				userId: userId as import("./_generated/dataModel").Id<"users">,
				paidEmailThreads: isActive,
			});
		}
	},
});

http.route({
	path: "/notes/webhook",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		return await resend.handleResendEventWebhook(ctx, req);
	}),
});

http.route({
	path: "/notes/inbound",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		const svixId = req.headers.get("svix-id");
		const svixTimestamp = req.headers.get("svix-timestamp");
		const svixSignature = req.headers.get("svix-signature");

		if (!svixId || !svixTimestamp || !svixSignature) {
			return new Response("Missing signature headers", { status: 400 });
		}

		const payload = await req.text();

		const result = await ctx.runAction(
			internal.inboundEmail.processInboundWebhook,
			{
				payload,
				svixId,
				svixTimestamp,
				svixSignature,
			},
		);

		if (!result.success && result.error === "invalid_signature") {
			return new Response("Invalid signature", { status: 401 });
		}

		if (!result.success && result.error === "server_config") {
			return new Response("Server configuration error", { status: 500 });
		}

		return new Response("OK", { status: 200 });
	}),
});

export default http;
