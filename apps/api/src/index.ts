import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { exportJWK, importSPKI } from "jose";
import { env, publicBaseUrl } from "./env";
import { sessionRoutes } from "./session";
import { verifyServerAuthToken } from "./middleware/auth";

const PORT = env.API_PORT;

const normalizeOrigin = (value?: string | null) => {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;

	const withProtocol = trimmed.startsWith("http")
		? trimmed
		: `https://${trimmed}`;

	try {
		const { origin } = new URL(withProtocol);
		return origin.replace(/\/+$/, "");
	} catch {
		return null;
	}
};

const staticOrigins = new Set<string>([
	"http://localhost:3000",
	"http://localhost:5173",
]);

const vercelHostSuffixes = [".vercel.app", ".vercel.dev"];

const createOriginMatcher = () => {
	const envOrigins = new Set<string>();

	const addOrigin = (value?: string | null) => {
		const normalized = normalizeOrigin(value);
		if (normalized) {
			envOrigins.add(normalized);
		}
	};

	addOrigin(process.env.VERCEL_URL);
	addOrigin(process.env.VERCEL_BRANCH_URL);
	addOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
	addOrigin(process.env.STAGING_VERCEL_URL);

	const extraOrigins = process.env.ALLOWED_ORIGINS?.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	if (extraOrigins) {
		for (const origin of extraOrigins) {
			addOrigin(origin);
		}
	}

	const originChecker = (request: Request) => {
		const originHeader = request.headers.get("origin");
		if (!originHeader) return;

		let parsed: URL;
		try {
			parsed = new URL(originHeader);
		} catch {
			return;
		}

		const normalizedOrigin = `${parsed.protocol}//${parsed.host}`;

		if (staticOrigins.has(normalizedOrigin)) {
			return true;
		}

		if (envOrigins.has(normalizedOrigin)) {
			return true;
		}

		if (vercelHostSuffixes.some((suffix) => parsed.hostname.endsWith(suffix))) {
			return true;
		}

		return;
	};

	return {
		originChecker,
		snapshot: {
			static: Array.from(staticOrigins),
			env: Array.from(envOrigins),
			wildcard: vercelHostSuffixes.map(
				(suffix) => `*.${suffix.replace(/^\./, "")}`,
			),
		},
	};
};

const { originChecker: allowOrigin, snapshot: allowedOriginsSnapshot } =
	createOriginMatcher();

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
	.use(
		cors({
			origin: allowOrigin,
			credentials: true,
		}),
	)
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
		console.log(
			`🌍 CORS static origins: ${allowedOriginsSnapshot.static.join(", ")}`,
		);
		if (allowedOriginsSnapshot.env.length) {
			console.log(
				`🌍 CORS env origins: ${allowedOriginsSnapshot.env.join(", ")}`,
			);
		}
		console.log(
			`🌍 CORS wildcard origins: ${allowedOriginsSnapshot.wildcard.join(", ")}`,
		);
	});

export type App = typeof app;
