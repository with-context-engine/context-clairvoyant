import type { AuthConfig } from "convex/server";

const getPublicBaseUrl = () => {
	return (
		process.env.PUBLIC_BASE_URL ||
		process.env.VITE_PUBLIC_BASE_URL ||
		"https://with-context-engine.ngrok.dev"
	);
};

const publicBaseUrl = getPublicBaseUrl();

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
