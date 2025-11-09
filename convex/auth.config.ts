import type { AuthConfig } from "convex/server";

const normalizeUrl = (value: string) => {
	const trimmed = value.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
};

const publicBaseUrl = (() => {
	const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
	if (railwayDomain) {
		return normalizeUrl(railwayDomain);
	}
	const fallback =
		process.env.PUBLIC_BASE_URL ||
		process.env.VITE_PUBLIC_BASE_URL ||
		"https://with-context-engine.ngrok.dev";
	return normalizeUrl(fallback);
})();

export default {
	providers: [
		{
			type: "customJwt",
			applicationID: "clairvoyant-backend",
			issuer: publicBaseUrl,
			jwks: `${publicBaseUrl}/.well-known/jwks.json`,
			algorithm: "RS256",
		},
	],
} satisfies AuthConfig;
