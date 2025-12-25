"use node";

import { Resend } from "@convex-dev/resend";
import { components, internal } from "./_generated/api";

export const resend: Resend = new Resend(components.resend, {
	testMode: process.env.RESEND_TEST_MODE !== "false",
	onEmailEvent: internal.emailEvents.handleEmailEvent,
});
