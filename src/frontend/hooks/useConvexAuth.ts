import { ConvexReactClient } from "convex/react";
import { useEffect, useRef, useState } from "react";

type AuthState =
	| { status: "idle" }
	| { status: "loading" }
	| {
			status: "authenticated";
			convexClient: ConvexReactClient;
			mentraUserId: string;
			convexUserId: string;
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

		fetch("/api/session/mentra", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ frontendToken }),
			signal: abortController.signal,
		})
			.then(async (res) => {
				// Check if request was aborted
				if (abortController.signal.aborted) return;

				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}));
					throw new Error(
						errorData.error || `Token exchange failed: ${res.statusText}`,
					);
				}

				const data = (await res.json()) as {
					convexUserId: string;
					mentraUserId: string;
					mentraToken: string;
					convexToken: string;
				};

				// Check if request was aborted after async operation
				if (abortController.signal.aborted) return;

				console.log("[Backend] Token exchanged:", data);

				// Create Convex client with auth token
				const client = new ConvexReactClient(
					import.meta.env.VITE_CONVEX_URL as string,
				);
				client.setAuth(() => Promise.resolve(data.convexToken));

				setAuthState({
					status: "authenticated",
					convexClient: client,
					mentraUserId: data.mentraUserId,
					convexUserId: data.convexUserId,
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

