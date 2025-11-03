import { ConvexHttpClient } from "convex/browser";
import { Elysia } from "elysia";
import { createHmac } from "node:crypto";
import { api } from "../../convex/_generated/api";
import { env } from "../utils/core/env";

const convex = new ConvexHttpClient(env.CONVEX_URL);

function verifyPolarWebhook(payload: string, signature: string): boolean {
	const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
	if (!webhookSecret) {
		console.error("[Webhook] POLAR_WEBHOOK_SECRET not configured");
		return false;
	}

	const hmac = createHmac("sha256", webhookSecret);
	hmac.update(payload);
	const expectedSignature = hmac.digest("hex");

	return signature === expectedSignature;
}

export const webhookRoutes = new Elysia({ prefix: "/api/webhooks" }).post(
	"/polar",
	async ({ body, headers, set }) => {
		try {
			const signature = headers["x-polar-signature"];
			const payload = JSON.stringify(body);

			if (!signature || !verifyPolarWebhook(payload, signature as string)) {
				console.error("[Webhook] Invalid signature");
				set.status = 401;
				return { error: "Invalid signature" };
			}

			const event = body as {
				type: string;
				data: {
					id: string;
					customer_id?: string;
					product_id?: string;
					metadata?: { userId?: string; mentraUserId?: string };
					status?: string;
				};
			};

			console.log(`[Webhook] Received Polar webhook: ${event.type}`);

			if (event.type === "checkout.completed") {
				const { metadata } = event.data;
				if (!metadata?.userId) {
					console.error("[Webhook] Missing userId in metadata");
					set.status = 400;
					return { error: "Missing userId in metadata" };
				}

				await convex.mutation(api.subscriptions.updateFromPolar, {
					userId: metadata.userId as any,
					tier: "pro",
					status: "active",
					polarSubscriptionId: event.data.id,
					polarCustomerId: event.data.customer_id,
				});

				console.log(
					`[Webhook] Updated subscription for user ${metadata.userId} to pro`,
				);
			} else if (event.type === "subscription.updated") {
				const { metadata, status } = event.data;
				if (!metadata?.userId) {
					console.error("[Webhook] Missing userId in metadata");
					set.status = 400;
					return { error: "Missing userId in metadata" };
				}

				const tier = status === "active" ? "pro" : "free";

				await convex.mutation(api.subscriptions.updateFromPolar, {
					userId: metadata.userId as any,
					tier,
					status: status || "active",
					polarSubscriptionId: event.data.id,
					polarCustomerId: event.data.customer_id,
				});

				console.log(
					`[Webhook] Updated subscription for user ${metadata.userId} to ${tier}`,
				);
			} else if (event.type === "subscription.canceled") {
				const { metadata } = event.data;
				if (!metadata?.userId) {
					console.error("[Webhook] Missing userId in metadata");
					set.status = 400;
					return { error: "Missing userId in metadata" };
				}

				await convex.mutation(api.subscriptions.updateFromPolar, {
					userId: metadata.userId as any,
					tier: "free",
					status: "canceled",
					polarSubscriptionId: event.data.id,
					polarCustomerId: event.data.customer_id,
				});

				console.log(
					`[Webhook] Canceled subscription for user ${metadata.userId}`,
				);
			}

			return { success: true };
		} catch (error) {
			console.error("[Webhook] Processing failed:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},
);
