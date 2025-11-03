import { ConvexHttpClient } from "convex/browser";
import { Elysia } from "elysia";
import { api } from "../../convex/_generated/api";
import { verifyFrontendToken } from "../middleware/mentra";
import { env } from "../utils/core/env";

const convex = new ConvexHttpClient(env.CONVEX_URL);

export const sessionRoutes = new Elysia({ prefix: "/api/session" }).post(
	"/mentra",
	async ({ body, set }) => {
		try {
			const { frontendToken } = body as { frontendToken?: string };

			if (!frontendToken) {
				set.status = 400;
				return { error: "frontendToken is required" };
			}

			const mentraUserId = verifyFrontendToken(
				frontendToken,
				env.MENTRAOS_API_KEY,
			);

			console.log(
				"[Session] Token verification:",
				mentraUserId ? `✓ Valid (userId: ${mentraUserId})` : "✗ Invalid",
			);

			if (!mentraUserId) {
				set.status = 401;
				return { error: "Invalid frontendToken" };
			}

			const convexUserId = await convex.mutation(api.users.getOrCreate, {
				mentraUserId,
			});

			return { success: true, convexUserId, mentraUserId };
		} catch (error) {
			console.error("[Session] Token exchange failed:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},
);
