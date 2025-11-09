import { createPrivateKey } from "node:crypto";
import { ConvexClient } from "convex/browser";
import { Elysia } from "elysia";
import jwt from "jsonwebtoken";
import { api } from "../../convex/_generated/api";
import { verifyFrontendToken } from "../middleware/mentra";
import { env, publicBaseUrl } from "./env";

const convex = new ConvexClient(env.CONVEX_URL);

export const sessionRoutes = new Elysia({ prefix: "/api/session" })
	.post("/mentra", async ({ body, set }) => {
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

			const privateKey = createPrivateKey({
				key: env.AUTH_PRIVATE_KEY_PEM.replace(/\\n/g, "\n"),
				format: "pem",
			});

			const issuer = publicBaseUrl;

			const convexToken = jwt.sign(
				{
					sub: convexUserId,
					aud: "clairvoyant-backend",
				},
				privateKey,
				{
					algorithm: "RS256",
					issuer,
					expiresIn: "15m",
					keyid: env.AUTH_KEY_ID,
				},
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
			set.status = 500;
			return { error: "Internal server error", details: error };
		}
	})
	.get("/health", () => {
		return { status: "ok" };
	});
