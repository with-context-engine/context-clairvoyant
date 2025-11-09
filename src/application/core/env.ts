import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		PACKAGE_NAME: z.string(),
		PORT: z.coerce.number(),
		MENTRAOS_API_KEY: z.string(),
		GROQ_API_KEY: z.string(),
		OPENAI_API_KEY: z.string(),
		OPENWEATHERMAP_API_KEY: z.string(),
		TAVILY_API_KEY: z.string(),
		GOOGLE_MAPS_API_KEY: z.string(),
		HONCHO_API_KEY: z.string(),
		CONVEX_URL: z.string(),
		AUTH_PRIVATE_KEY_PEM: z.string(),
		AUTH_PUBLIC_KEY_PEM: z.string(),
		AUTH_KEY_ID: z.string(),
		PUBLIC_BASE_URL: z.string().optional(),
		RAILWAY_PUBLIC_DOMAIN: z.string().optional(),
		API_PORT: z.coerce.number().optional(),
	},
	runtimeEnv: process.env,
});

const DEFAULT_PUBLIC_BASE_URL = "https://with-context-engine.ngrok.dev";

const normalizeUrl = (value: string) => {
	const trimmed = value.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
};

export const publicBaseUrl = (() => {
	const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
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
