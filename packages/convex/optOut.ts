"use node";

import { render } from "@react-email/render";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { OptOutCheckoutEmail } from "./emails/OptOutCheckout";
import { resend } from "./resendClient";

const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "notes.example.com";

export const requestOptOutCheckoutEmail = action({
	args: { mentraUserId: v.string() },
	handler: async (ctx, args) => {
		const user = await ctx.runQuery(api.users.getByMentraId, {
			mentraUserId: args.mentraUserId,
		});

		if (!user) {
			return { success: false as const, reason: "user_not_found" };
		}

		if (!user.email) {
			return { success: false as const, reason: "no_email_configured" };
		}

		if (user.optedOutOfTraining) {
			return { success: true as const, alreadyOptedOut: true };
		}

		const checkout = await ctx.runAction(
			internal.payments.createFeatureCheckoutLinkInternal,
			{
				userId: user._id,
				feature: "optOut",
			},
		);

		const html = await render(
			OptOutCheckoutEmail({ checkoutUrl: checkout.url }),
		);

		await resend.sendEmail(ctx, {
			from: `Clairvoyant <noreply@${EMAIL_DOMAIN}>`,
			to: user.email,
			subject: "Complete your paid opt-out setup",
			html,
		});

		return { success: true as const, alreadyOptedOut: false };
	},
});
