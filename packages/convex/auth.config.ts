import type { AuthConfig } from "convex/server";

const normalizeUrl = (value: string) => {
	const trimmed = value.trim();
	const withProtocol = /^https?:\/\//i.test(trimmed)
		? trimmed
		: `https://${trimmed}`;
	return withProtocol.replace(/\/+$/, "");
};

const issuerCandidates = (
	process.env.RAILWAY_PUBLIC_DOMAIN
		? process.env.RAILWAY_PUBLIC_DOMAIN.split(",")
		: []
)
	.map((value) => value.trim())
	.filter((value) => value.length > 0)
	.map((value) => normalizeUrl(value));

export default {
	providers: issuerCandidates.map((issuer) => ({
		type: "customJwt",
		applicationID: "clairvoyant-backend",
		issuer,
		jwks: `${issuer}/.well-known/jwks.json`,
		algorithm: "RS256",
	})),
} satisfies AuthConfig;
