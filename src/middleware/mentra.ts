import crypto from "node:crypto";

/**
 * Verifies a MentraOS frontendToken and extracts the user ID
 *
 * The frontendToken format is: userId:hash
 * where hash = sha256(userId + sha256(apiKey))
 *
 * @param frontendToken - The token to verify (format: userId:hash)
 * @param apiKey - Your MentraOS API key
 * @returns The userId if valid, null if invalid
 */
export function verifyFrontendToken(
	frontendToken: string,
	apiKey: string,
): string | null {
	try {
		const tokenParts = frontendToken.split(":");
		if (tokenParts.length !== 2) return null;

		const [tokenUserId, tokenHash] = tokenParts;
		if (!tokenUserId || !tokenHash) return null;

		const hashedApiKey = crypto
			.createHash("sha256")
			.update(apiKey)
			.digest("hex");

		const expectedHash = crypto
			.createHash("sha256")
			.update(tokenUserId)
			.update(hashedApiKey)
			.digest("hex");

		if (tokenHash === expectedHash) {
			return tokenUserId;
		}

		return null;
	} catch (error) {
		console.error("[verifyFrontendToken] Error:", error);
		return null;
	}
}
