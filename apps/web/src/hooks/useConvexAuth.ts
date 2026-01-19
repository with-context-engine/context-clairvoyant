import type { Id } from "@convex/_generated/dataModel";
import { ConvexReactClient } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { convexUrl } from "../env";
import { api } from "../lib/api";

type AuthState =
	| { status: "idle" }
	| { status: "loading" }
	| {
			status: "authenticated";
			convexClient: ConvexReactClient;
			mentraUserId: string;
			convexUserId: Id<"users">;
			convexToken: string;
	  }
	| { status: "error"; error: string };

export function useConvexAuth(
	userId: string | null,
	frontendToken: string | null,
	isAuthenticated: boolean,
) {
	const [authState, setAuthState] = useState<AuthState>({ status: "idle" });
	const abortControllerRef = useRef<AbortController | null>(null);

	useEffect(() => {
		// Reset state if not authenticated
		if (!isAuthenticated || !userId || !frontendToken) {
			setAuthState({ status: "idle" });
			return;
		}

		// Abort any in-flight request
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Create new abort controller for this request
		const abortController = new AbortController();
		abortControllerRef.current = abortController;

		setAuthState({ status: "loading" });

		api.api.session.mentra
			.post({ frontendToken }, { fetch: { signal: abortController.signal } })
			.then(({ data, error }) => {
				// Check if request was aborted
				if (abortController.signal.aborted) return;

				if (error || !data || !("convexUserId" in data)) {
					throw new Error(
						(error as { error?: string })?.error ||
							"Token exchange failed",
					);
				}

				const { convexUserId, mentraUserId, convexToken, expiresAt } = data;
				if (!convexUserId || !mentraUserId || !convexToken) {
					throw new Error("Invalid session response");
				}

				// Create Convex client with auth token
				const client = new ConvexReactClient(convexUrl);

				// Store token for refresh capability
				let currentToken = convexToken;
				const tokenExpiresAt = new Date(
					expiresAt || Date.now() + 15 * 60 * 1000,
				);

				// Set auth with a function that can refresh tokens
				client.setAuth(async () => {
					// If token is about to expire (within 1 minute), refresh it
					if (Date.now() > tokenExpiresAt.getTime() - 60 * 1000) {
						try {
							const refreshResult = await api.api.session.mentra.post({
								frontendToken,
							});
							if (refreshResult.data && "convexToken" in refreshResult.data) {
								currentToken = refreshResult.data.convexToken ?? currentToken;
							}
						} catch (err) {
							console.error("[ConvexAuth] Token refresh failed:", err);
						}
					}
					return currentToken;
				});

				setAuthState({
					status: "authenticated",
					convexClient: client,
					mentraUserId,
					convexUserId: convexUserId as Id<"users">,
					convexToken,
				});
			})
			.catch((err) => {
				// Ignore abort errors
				if (err.name === "AbortError" || abortController.signal.aborted) {
					return;
				}

				console.error("[Backend] Exchange error:", err);
				setAuthState({
					status: "error",
					error: err instanceof Error ? err.message : "Authentication failed",
				});
			});

		// Cleanup: abort request on unmount or dependency change
		return () => {
			abortController.abort();
		};
	}, [userId, frontendToken, isAuthenticated]);

	return authState;
}
