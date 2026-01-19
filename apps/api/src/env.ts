import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		API_PORT: z.coerce
			.number()
			.default(process.env.PORT ? Number(process.env.PORT) : 3000),
		MENTRAOS_API_KEY: z.string(),
		CONVEX_URL: z.string(),
		AUTH_PUBLIC_KEY_PEM: z.string(),
		AUTH_PRIVATE_KEY_PEM: z.string(),
		AUTH_KEY_ID: z.string(),
		PUBLIC_BASE_URL: z.string().optional(),
		RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
	},
	runtimeEnv: process.env,
});

const DEFAULT_PUBLIC_BASE_URL = process.env.NGROK_WEB_DOMAIN 
	? `https://${process.env.NGROK_WEB_DOMAIN}` 
	: "http://localhost:5173";

const normalizeUrl = (value: string) => {
	const trimmed = value.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
};

export const publicBaseUrl = (() => {
	const railwayDomain = env.RAILWAY_PUBLIC_DOMAIN?.trim();
	if (railwayDomain) {
		return normalizeUrl(railwayDomain);
	}
	const configured = env.PUBLIC_BASE_URL?.trim();
	if (configured) {
		return normalizeUrl(configured);
	}
	return DEFAULT_PUBLIC_BASE_URL;
})();

export const publicJwksUrl = `${publicBaseUrl}/.well-known/jwks.json`;
