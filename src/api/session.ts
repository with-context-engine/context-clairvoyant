import { ConvexClient } from "convex/browser";
import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import { api } from "../../convex/_generated/api";
import { env } from "../application/core/env";
import { verifyFrontendToken } from "../middleware/mentra";

const convex = new ConvexClient(env.CONVEX_URL);

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

			const mentraToken = frontendToken.split(":")[1];
			if (!mentraToken) {
				set.status = 400;
				return { error: "Invalid frontendToken: no token part" };
			}

			const convexUserId = await convex.mutation(api.users.getOrCreate, {
				mentraUserId,
				mentraToken,
			});

			const convexToken = jwt.sign(
				{
					sub: convexUserId,
					iss: "clairvoyant-backend",
				},
				env.CONVEX_AUTH_SECRET,
				{ expiresIn: "15m" },
			);

			return {
				success: true,
				convexUserId,
				mentraUserId,
				mentraToken,
				convexToken,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
			};
		} catch (error) {
			console.error("[Session] Token exchange failed:", error);
			set.status = 500;
			return { error: "Internal server error" };
		}
	},
);
