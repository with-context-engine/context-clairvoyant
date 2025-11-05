import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { exportJWK, importSPKI } from "jose";
import { sessionRoutes } from "./api/session";
import { env } from "./application/core/env";
import { verifyServerAuthToken } from "./middleware/auth";

const API_PORT = parseInt(process.env.API_PORT || "3001");

// Guard plugin for protecting routes that require authentication
// Usage: .use(requireAuth) before route definitions
export const requireAuth = new Elysia({ name: "requireAuth" }).onBeforeHandle(
	({ authUserId, set }) => {
		if (!authUserId) {
			set.status = 401;
			return { error: "Unauthorized" };
		}
	},
);

export const app = new Elysia()
	.use(cors())
	.get("/.well-known/jwks.json", async () => {
		const spki = env.AUTH_PUBLIC_KEY_PEM.replace(/\\n/g, "\n");
		const key = await importSPKI(spki, "RS256");
		const jwk = await exportJWK(key);
		return {
			keys: [
				{
					...jwk,
					alg: "RS256",
					use: "sig",
					kid: env.AUTH_KEY_ID,
				},
			],
		};
	})
		.derive(({ headers }) => {
		const auth = headers["authorization"];
		let authUserId: string | null = null;
		if (auth?.startsWith("Bearer ")) {
			const token = auth.slice(7);
			authUserId = verifyServerAuthToken(
				token,
				env.AUTH_PUBLIC_KEY_PEM,
				env.PUBLIC_BASE_URL,
			);
		}
		return { authUserId };
	})
	.use(sessionRoutes)
	// Health endpoint is public but shows auth status
	.get("/api/health", ({ authUserId }) => ({
		status: "ok",
		authenticated: !!authUserId,
		timestamp: new Date().toISOString(),
	}))
	.listen(API_PORT, ({ hostname, port }) => {
		console.log(
			`🦊 Elysia API server is running at http://${hostname}:${port}`,
		);
	});

export type App = typeof app;
