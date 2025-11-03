import { useMentraAuth } from "@mentra/react";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export function App() {
	const { userId, frontendToken, isAuthenticated } = useMentraAuth();
	const [convexUserId, setConvexUserId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const user = useQuery(
		api.users.getByMentraId,
		userId ? { mentraUserId: userId } : "skip",
	);

	useEffect(() => {
		if (userId && frontendToken && isAuthenticated) {
			console.log("[Mentra] Got userId and frontendToken");
			fetch("/api/session/mentra", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ frontendToken }),
			})
				.then(async (res) => {
					if (!res.ok) throw new Error("Token exchange failed");
					const data = (await res.json()) as { convexUserId: string };
					console.log("[Backend] Token exchanged:", data);
					setConvexUserId(data.convexUserId);
				})
				.catch((err) => {
					console.error("[Backend] Exchange error:", err);
					setError(err.message);
				});
		}
	}, [userId, frontendToken, isAuthenticated]);

	if (!isAuthenticated) {
		return (
			<div style={{ padding: "20px", fontFamily: "system-ui" }}>
				<h1>Clairvoyant</h1>
				<p>Not authenticated. Please open from MentraOS app.</p>
			</div>
		);
	}

	return (
		<div style={{ padding: "20px", fontFamily: "system-ui" }}>
			<h1>Clairvoyant</h1>
			<p>
				<strong>Mentra User ID:</strong> {userId}
			</p>
			{error && <p style={{ color: "red" }}>Error: {error}</p>}
			{convexUserId && (
				<p>
					<strong>Convex User ID:</strong> {convexUserId}
				</p>
			)}
			{user && (
				<p>
					<strong>Created:</strong> {new Date(user._creationTime).toLocaleString()}
				</p>
			)}
		</div>
	);
}
