import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { sessionRoutes } from "./api/session";
import { webhookRoutes } from "./api/webhooks";

const API_PORT = parseInt(process.env.API_PORT || "3001");

export const app = new Elysia()
	.use(cors())
	.use(sessionRoutes)
	.use(webhookRoutes)
	.get("/api/health", () => ({
		status: "ok",
		timestamp: new Date().toISOString(),
	}))
	.listen(API_PORT, ({ hostname, port }) => {
		console.log(
			`🦊 Elysia API server is running at http://${hostname}:${port}`,
		);
	});

export type App = typeof app;
