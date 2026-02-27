"use node";

import { render } from "@react-email/render";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { FREE_EMAIL_THREAD_LIMIT } from "./emailEntitlements";
import { EmailThreadPaywallEmail } from "./emails/EmailThreadPaywall";
import { resend } from "./resendClient";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "notes.example.com";

function currentPeriodKey(): string {
	const now = new Date();
	const month = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${now.getUTCFullYear()}-${month}`;
}

export const preflightOutboundEmail = internalAction({
	args: { userId: v.id("users") },
	handler: async (
		ctx,
		args,
	): Promise<{ allowed: boolean; trackUsage: boolean; reason?: string }> => {
		const user = await ctx.runQuery(internal.users.getByIdInternal, {
			userId: args.userId,
		});
		if (!user) {
			return {
				allowed: false as const,
				trackUsage: false,
				reason: "user_not_found",
			};
		}

		if (user.paidEmailThreads) {
			return { allowed: true as const, trackUsage: false };
		}

		const periodKey = currentPeriodKey();
		const usage = await ctx.runQuery(
			internal.emailEntitlements.getUsageByUserPeriod,
			{
				userId: args.userId,
				periodKey,
			},
		);

		const used = usage?.outboundCount ?? 0;
		if (used < FREE_EMAIL_THREAD_LIMIT) {
			return { allowed: true as const, trackUsage: true };
		}

		if (!usage?.paywallEmailSentAt && user.email) {
			try {
				const checkout = await ctx.runAction(
					internal.payments.createFeatureCheckoutLinkInternal,
					{
						userId: args.userId,
						feature: "emailThreads",
					},
				);

				const html = await render(
					EmailThreadPaywallEmail({
						checkoutUrl: checkout.url,
						limit: FREE_EMAIL_THREAD_LIMIT,
					}),
				);

				await resend.sendEmail(ctx, {
					from: `Clairvoyant <noreply@${EMAIL_DOMAIN}>`,
					to: user.email,
					subject: "Continue your Clairvoyant email thread",
					html,
				});

				await ctx.runMutation(internal.emailEntitlements.markPaywallSent, {
					userId: args.userId,
					periodKey,
				});
			} catch (error) {
				console.error(
					"[EmailEntitlements] Failed to send paywall email:",
					error,
				);
			}
		}

		return {
			allowed: false as const,
			trackUsage: false,
			reason: "limit_reached",
		};
	},
});
