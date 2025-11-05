import jwt from "jsonwebtoken";

/**
 * Verifies a JWT token issued by our authentication server
 *
 * @param token - The JWT token to verify
 * @param publicKeyPem - The RSA public key in PEM format
 * @param issuer - The expected issuer (PUBLIC_BASE_URL)
 * @returns The user ID (sub claim) if valid, null if invalid
 */
export function verifyServerAuthToken(
	token: string,
	publicKeyPem: string,
	issuer: string,
): string | null {
	try {
		const payload = jwt.verify(token, publicKeyPem.replace(/\\n/g, "\n"), {
			algorithms: ["RS256"],
			issuer,
			audience: "clairvoyant-backend",
		}) as jwt.JwtPayload;

		return (payload.sub as string) || null;
	} catch (error) {
		console.error("[verifyServerAuthToken] Token verification failed:", error);
		return null;
	}
}
