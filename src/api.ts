import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { exportJWK, importSPKI } from "jose";
import { env, publicBaseUrl } from "./api/env";
import { sessionRoutes } from "./api/session";
import { verifyServerAuthToken } from "./middleware/auth";

const PORT = env.API_PORT;

export const requireAuth = new Elysia({ name: "requireAuth" }).onBeforeHandle(
	({ headers }) => {
		const auth = headers.authorization;
		let authUserId: string | null = null;
		if (auth?.startsWith("Bearer ")) {
			const token = auth.slice(7);
			authUserId = verifyServerAuthToken(
				token,
				env.AUTH_PUBLIC_KEY_PEM,
				publicBaseUrl,
			);
		}
		return { authUserId };
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
		const auth = headers.authorization;
		let authUserId: string | null = null;
		if (auth?.startsWith("Bearer ")) {
			const token = auth.slice(7);
			authUserId = verifyServerAuthToken(
				token,
				env.AUTH_PUBLIC_KEY_PEM,
				publicBaseUrl,
			);
		}
		return { authUserId };
	})
	.use(sessionRoutes)
	.get("/api/health", ({ authUserId }) => ({
		status: "ok",
		authenticated: !!authUserId,
		timestamp: new Date().toISOString(),
	}))
	.listen(PORT, ({ hostname, port }) => {
		console.log(
			`🦊 Elysia API server is running at http://${hostname}:${port}`,
		);
		console.log(`🔑 Public base URL: ${publicBaseUrl}`);
	});

export type App = typeof app;
